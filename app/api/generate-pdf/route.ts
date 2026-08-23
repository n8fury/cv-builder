/**
 * PDF export (SPEC §8, §15.10).
 *
 * Prints the `/render` route with headless Chromium so the download and the
 * live preview come from one template — there is no second layout system to
 * keep in sync. Chromium is launched per request and closed again (§8): at
 * personal-use volume a pooled browser buys a second or two and costs a class
 * of staleness bug, so nothing is cached and nothing is reused.
 */
import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

import { NotFoundError } from "@/lib/data/store";
import { loadRenderModel } from "@/lib/render/load";

/** Chromium and the filesystem reads make this a Node runtime route. */
export const runtime = "nodejs";
/** The variant on disk is the source of truth on every request (§8: no cache). */
export const dynamic = "force-dynamic";

/** SPEC §2: Letter, and the CSS `@page` size the render route declares. */
const PAGE_FORMAT = "Letter" as const;

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const profileId = params.get("profileId");
  const variantId = params.get("variantId");

  if (!profileId || !variantId) {
    return errorResponse(400, "profileId and variantId are both required");
  }

  // Resolve before launching Chromium: a bad id should cost a file read, not a
  // browser, and it maps to 404 here exactly as it does on /render (§13).
  try {
    await loadRenderModel(profileId, variantId);
  } catch (error) {
    if (error instanceof NotFoundError) return errorResponse(404, error.message);
    return errorResponse(500, error instanceof Error ? error.message : String(error));
  }

  const target = new URL(
    `/render/${encodeURIComponent(profileId)}/${encodeURIComponent(variantId)}`,
    request.url,
  );

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(target.href, { waitUntil: "networkidle0" });

    // The commonest silent-fallback bug: printing before the faces resolve
    // moves every baseline (§8). Task 4.2 turns a failed face into a 500.
    await page.evaluateHandle("document.fonts.ready");

    const pdf = await page.pdf({
      format: PAGE_FORMAT,
      // Both agree by design (§15.10) — either alone risks a silent mismatch
      // if the other is edited later.
      preferCSSPageSize: true,
      printBackground: true,
      // All real margins are 55pt of padding on the page wrapper (§8);
      // Puppeteer's own margins would fight `preferCSSPageSize`.
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${profileId}-${variantId}.pdf"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // §13: a Puppeteer failure is a 500 the dashboard can surface as a toast,
    // never a truncated or empty download.
    return errorResponse(
      500,
      `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    // §8: one browser per request, closed even when printing threw — an
    // orphaned Chromium would outlive the dev server.
    await browser?.close();
  }
}
