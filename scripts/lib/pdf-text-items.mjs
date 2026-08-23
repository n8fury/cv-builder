/**
 * Read text-item geometry out of a PDF via pdfjs-dist.
 *
 * Shared by the golden extractor and the fidelity harness so both sides of the
 * §11.2 diff are measured by identical code — a difference in the reading is
 * otherwise indistinguishable from a difference in the render.
 *
 * Coordinates come back in PDF user space: origin bottom-left, y increasing
 * upward, units in points. That is the frame SPEC §4 quotes its measurements
 * in, so values are directly comparable without conversion.
 */
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

/** Coordinates are kept to this many decimals — far under the ±2pt tolerance. */
export const PRECISION = 2;

export function round(value) {
  return Number(value.toFixed(PRECISION));
}

/**
 * Embedded subsets carry a random six-letter tag (`UDSQTU+CharterBT-Bold`).
 * The tag differs per export, so identity comparisons use the bare face name.
 */
export function normalizeFontName(name) {
  return name.replace(/^[A-Z]{6}\+/, "");
}

/** Resolve pdf.js's internal font id (`g_d0_f1`) to the embedded face name. */
function resolveFontName(page, fontId) {
  if (!page.commonObjs.has(fontId)) return fontId;
  const font = page.commonObjs.get(fontId);
  return normalizeFontName(font?.name ?? fontId);
}

async function extractPage(page, pageNumber) {
  // Populates commonObjs with the font objects getTextContent only names by id.
  await page.getOperatorList();
  const { items } = await page.getTextContent();

  return items
    .filter((item) => item.str.trim() !== "")
    .map((item) => {
      const [scaleX, skewY, , scaleY, x, baselineY] = item.transform;
      return {
        page: pageNumber,
        text: item.str,
        x: round(x),
        baselineY: round(baselineY),
        fontName: resolveFontName(page, item.fontName),
        fontSize: round(Math.hypot(skewY, scaleY) || Math.abs(scaleX)),
      };
    });
}

/** Reading order: top-to-bottom, then left-to-right — stable across runs. */
export function byReadingOrder(a, b) {
  return a.page - b.page || b.baselineY - a.baselineY || a.x - b.x;
}

/**
 * @param {Uint8Array} bytes raw PDF
 * @returns {Promise<{ pages: Array<{page:number,width:number,height:number}>,
 *                     items: Array<{page:number,text:string,x:number,
 *                                   baselineY:number,fontName:string,
 *                                   fontSize:number}> }>}
 */
export async function extractTextItems(bytes) {
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: false,
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;

  const pages = [];
  const items = [];
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const [, , width, height] = page.view;
      pages.push({ page: pageNumber, width: round(width), height: round(height) });
      items.push(...(await extractPage(page, pageNumber)));
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  items.sort(byReadingOrder);
  return { pages, items };
}
