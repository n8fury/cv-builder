/**
 * The export route's failure paths (SPEC §13).
 *
 * Three of §13's five rows are decided inside this handler — a Puppeteer
 * failure, an unusable font face, and an unknown id — and all three are hard
 * to reach from a running server: they need a browser that breaks on demand.
 * Mocking `puppeteer` lets each one be provoked exactly, and asserts the part
 * that actually matters to §13: what status and what message reach the
 * dashboard, and that no PDF bytes are emitted when the page was not
 * trustworthy.
 *
 * The rows this file does *not* cover are covered where they live: a visible
 * section with nothing under it in `ResumeSectionBody.test.tsx`, and the
 * disabled-with-spinner download in `scripts/check-errors.mjs`, which needs a
 * real DOM.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const launch = vi.fn();
vi.mock("puppeteer", () => ({ default: { launch: (...args: unknown[]) => launch(...args) } }));

const loadRenderModel = vi.fn();
vi.mock("@/lib/render/load", () => ({
  loadRenderModel: (...args: unknown[]) => loadRenderModel(...args),
}));

import { NotFoundError } from "@/lib/data/store";
import { requiredFaceDescriptors } from "@/lib/render/font-check";

import { GET } from "./route";

/** The PDF bytes a healthy page produces, distinct enough to spot in a body. */
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

interface PageBehavior {
  /** Thrown from `page.goto`, standing in for a render that dies mid-load. */
  gotoError?: Error;
  /** What the in-page font check reports back (§13's second row). */
  fontProblems?: string[];
}

const pdf = vi.fn();
const close = vi.fn();

/** A Chromium stand-in whose page fails in whichever way the test needs. */
function fakeBrowser({ gotoError, fontProblems = [] }: PageBehavior = {}) {
  pdf.mockResolvedValue(PDF_BYTES);
  close.mockResolvedValue(undefined);
  return {
    newPage: async () => ({
      setCacheEnabled: async () => undefined,
      goto: async () => {
        if (gotoError) throw gotoError;
      },
      evaluateHandle: async () => undefined,
      // The route hands `findFontProblems` to Puppeteer for serialisation, so
      // the mock answers with the verdict rather than running it.
      evaluate: async () => fontProblems,
      pdf,
    }),
    close,
  };
}

function request(query: string) {
  return new Request(`http://localhost:3000/api/generate-pdf${query}`);
}

const GOOD = "?profileId=jordan-rivera&variantId=detailed";

async function errorOf(response: Response): Promise<string> {
  return ((await response.json()) as { error: string }).error;
}

beforeEach(() => {
  vi.clearAllMocks();
  loadRenderModel.mockResolvedValue({
    profileId: "jordan-rivera",
    variantId: "detailed",
    model: {},
  });
  launch.mockImplementation(async () => fakeBrowser());
});

describe("a Puppeteer failure (§13, row 1)", () => {
  it("is a 500 carrying the reason, not a truncated download", async () => {
    launch.mockRejectedValue(new Error("Failed to launch the browser process"));

    const response = await GET(request(GOOD));

    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await errorOf(response)).toContain("Failed to launch the browser process");
  });

  it("reports a render that dies after launch the same way", async () => {
    launch.mockImplementation(async () => fakeBrowser({ gotoError: new Error("net::ERR_FAILED") }));

    const response = await GET(request(GOOD));

    expect(response.status).toBe(500);
    expect(await errorOf(response)).toContain("net::ERR_FAILED");
  });

  it("closes the browser on the failing path, so no Chromium is left behind", async () => {
    launch.mockImplementation(async () => fakeBrowser({ gotoError: new Error("net::ERR_FAILED") }));

    await GET(request(GOOD));

    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("an unusable font face (§13, row 2 — export path)", () => {
  it("aborts with a 500 naming every face that failed", async () => {
    launch.mockImplementation(async () =>
      fakeBrowser({
        fontProblems: [
          "CV Charter regular 400 failed to load (status: error)",
          "CV Charis italic 400 is not declared in the document",
        ],
      }),
    );

    const response = await GET(request(GOOD));

    expect(response.status).toBe(500);
    const message = await errorOf(response);
    expect(message).toContain("CV Charter regular 400 failed to load (status: error)");
    expect(message).toContain("CV Charis italic 400 is not declared in the document");
  });

  it("never reaches page.pdf() — a wrong-typeface PDF is worse than an error", async () => {
    launch.mockImplementation(async () =>
      fakeBrowser({ fontProblems: ["CV Charter bold 700 failed to load (status: error)"] }),
    );

    await GET(request(GOOD));

    expect(pdf).not.toHaveBeenCalled();
  });

  it("prints when every required face checks out", async () => {
    const response = await GET(request(GOOD));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(pdf).toHaveBeenCalledTimes(1);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF_BYTES);
  });

  it("asks about every face the document is required to carry", () => {
    // The route's pre-flight is only as good as the list it checks against;
    // an empty or half-populated list would pass silently.
    expect(requiredFaceDescriptors().length).toBeGreaterThanOrEqual(4);
  });
});

describe("an unknown profile or variant (§13, row 4)", () => {
  it("is a 404 naming what was missing", async () => {
    loadRenderModel.mockRejectedValue(new NotFoundError("No such variant: nope"));

    const response = await GET(request("?profileId=jordan-rivera&variantId=nope"));

    expect(response.status).toBe(404);
    expect(await errorOf(response)).toContain("No such variant: nope");
  });

  it("costs a file read, not a browser launch", async () => {
    loadRenderModel.mockRejectedValue(new NotFoundError("No such profile: nobody"));

    await GET(request("?profileId=nobody&variantId=detailed"));

    expect(launch).not.toHaveBeenCalled();
  });

  it("rejects a request missing either id with a 400", async () => {
    expect((await GET(request("?variantId=detailed"))).status).toBe(400);
    expect((await GET(request("?profileId=jordan-rivera"))).status).toBe(400);
    expect(launch).not.toHaveBeenCalled();
  });

  it("keeps a malformed library a 500, distinct from a missing one", async () => {
    // §13 maps only a *missing* file to 404; a file that exists but does not
    // parse is a different problem and must not read as "no such variant".
    loadRenderModel.mockRejectedValue(new Error("library.json: expected an array"));

    const response = await GET(request(GOOD));

    expect(response.status).toBe(500);
    expect(await errorOf(response)).toContain("library.json");
  });
});
