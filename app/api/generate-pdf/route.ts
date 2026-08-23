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
import puppeteer, { type Browser, type Page } from "puppeteer";

import { NotFoundError } from "@/lib/data/store";
import { REQUIRED_FONT_FACES, faceLabel, faceShorthand } from "@/lib/render/fonts";
import { loadRenderModel } from "@/lib/render/load";
import { PDF_PAGE_OPTIONS } from "@/lib/render/pdf-options";
import { contentDisposition, renderPath } from "@/lib/routes";

/** Chromium and the filesystem reads make this a Node runtime route. */
export const runtime = "nodejs";
/** The variant on disk is the source of truth on every request (§8: no cache). */
export const dynamic = "force-dynamic";

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Verify every required face actually loaded, in the page that is about to be
 * printed (SPEC §8, §13, §15.14).
 *
 * `document.fonts.ready` alone is not enough: it settles once loading has
 * *finished*, successfully or not, so a missing woff2 resolves it just the
 * same and the page paints in `serif`. Each face is therefore looked up among
 * the document's CSS-connected faces, forced to load if the page never used
 * it, and checked. Returns one message per unusable face, empty when all four
 * are good.
 */
async function checkFonts(page: Page): Promise<string[]> {
  const required = REQUIRED_FONT_FACES.map((face) => ({
    label: faceLabel(face),
    family: face.family,
    style: face.style,
    weight: String(face.weight),
    shorthand: faceShorthand(face),
  }));

  return page.evaluate(async (faces) => {
    const declared: FontFace[] = [];
    document.fonts.forEach((face) => declared.push(face));

    const problems: string[] = [];
    for (const wanted of faces) {
      const face = declared.find(
        (candidate) =>
          candidate.family.replace(/^["']|["']$/g, "") === wanted.family &&
          candidate.style === wanted.style &&
          candidate.weight === wanted.weight,
      );
      if (!face) {
        problems.push(`${wanted.label} is not declared in the document`);
        continue;
      }
      // A face the resume never uses is still required to exist: whether this
      // variant happens to render italics must not decide whether the export
      // is trustworthy.
      if (face.status === "unloaded") {
        await face.load().catch(() => undefined);
      }
      if (face.status !== "loaded") {
        problems.push(`${wanted.label} failed to load (status: ${face.status})`);
      } else if (!document.fonts.check(wanted.shorthand)) {
        problems.push(`${wanted.label} loaded but document.fonts.check() rejects it`);
      }
    }
    return problems;
  }, required);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const profileId = params.get("profileId");
  const variantId = params.get("variantId");
  // The dashboard's Download button asks for an attachment; without it the
  // response stays inline so the browser's own PDF viewer can open it (§7).
  const download = params.get("download") === "1";

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

  const target = new URL(renderPath(profileId, variantId), request.url);

  let browser: Browser | null = null;
  try {
    // §8: a fresh instance per request. Puppeteer gives each launch its own
    // throwaway user-data-dir, so nothing — profile, HTTP cache, service
    // worker — carries over from the last export.
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    // Belt and braces on top of that: this page must never serve the resume,
    // its CSS or its woff2 files from a cache. Regenerating from scratch every
    // time costs a couple of seconds and rules out a whole class of stale-PDF
    // bug (§8: no caching).
    await page.setCacheEnabled(false);
    await page.goto(target.href, { waitUntil: "networkidle0" });

    // The commonest silent-fallback bug: printing before the faces resolve
    // moves every baseline (§8).
    await page.evaluateHandle("document.fonts.ready");

    // §13, §15.14: the preview may fall back to `serif`, the export may not.
    // A plausible-looking PDF in the wrong typeface is worse than an error —
    // it is the kind of thing you notice after sending it.
    const fontProblems = await checkFonts(page);
    if (fontProblems.length > 0) {
      return errorResponse(
        500,
        `PDF generation aborted — font faces unavailable: ${fontProblems.join("; ")}`,
      );
    }

    // §15.10's four settings, pinned and unit-tested in lib/render/pdf-options.
    const pdf = await page.pdf(PDF_PAGE_OPTIONS);

    return new NextResponse(Buffer.from(pdf) as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(profileId, variantId, { download }),
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
    // §8: one browser per request, torn down on every exit path — the 500s
    // above return from inside the `try`, and an orphaned Chromium would
    // outlive the request that spawned it and leak a process per download.
    // A failure to close must not turn a good PDF into an error response.
    await browser?.close().catch(() => undefined);
  }
}
