/**
 * Measures the rendered resume page in a real browser.
 *
 * The whole project is a geometry claim, so "the CSS says 55pt" is not
 * evidence — only a laid-out box is. This drives a headless Chrome over the
 * DevTools protocol (see ./lib/chrome.mjs) and prints the measured page box,
 * its padding, and the content box's left and right edges, all converted back
 * into points.
 *
 * Baselines are measured, not inferred: a zero-sized inline-block probe is
 * appended to each element, and its bottom edge sits exactly on that
 * element's last baseline. Positions are reported both from the top of the
 * document and as PDF-style y (up from the page bottom), so they can be read
 * straight against SPEC §4's coordinates.
 *
 * Usage: node scripts/measure-render.mjs [url] [comma-separated selectors]
 */
import { connect, openPage, withBrowser } from "./lib/chrome.mjs";

const PX_PER_PT = 96 / 72;
const PAGE_HEIGHT_PT = 792;

const url = process.argv[2] ?? "http://localhost:3000/render/jordan-rivera/detailed";
const selectors = (process.argv[3] ?? ".resume-page,.resume-name,.resume-contact")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

/** The measurement itself, evaluated in the page. Returns points, not pixels. */
const MEASURE = (selectorList, pxPerPt, pageHeightPt) => {
  const pt = (value) => Number((value / pxPerPt).toFixed(2));

  /* A zero-sized inline-block aligns its bottom margin edge to the baseline
     of the line it lands on — the only way to read a baseline out of the DOM.
     Prepended it reports the first line's baseline, appended the last one's.
     They differ for anything multi-line, and for a heading, whose ::after rule
     pushes an appended probe onto a line of its own below the text. */
  const baselineOf = (node, where) => {
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    if (where === "first") node.insertBefore(probe, node.firstChild);
    else node.appendChild(probe);
    const { bottom } = probe.getBoundingClientRect();
    probe.remove();
    return bottom;
  };

  const measured = [];
  for (const selector of selectorList) {
    const nodes = document.querySelectorAll(selector);
    if (nodes.length === 0) measured.push({ selector, missing: true });
    nodes.forEach((node, index) => {
      const box = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const firstBaseline = pt(baselineOf(node, "first"));
      const lastBaseline = pt(baselineOf(node, "last"));
      /* The border box spans the full content width for a block, so the ink
         itself is measured separately — that is what §4's x values refer to. */
      const range = document.createRange();
      range.selectNodeContents(node);
      const ink = range.getBoundingClientRect();
      measured.push({
        selector,
        index,
        text: (node.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 48),
        font: style.fontFamily.split(",")[0].replace(/["']/g, ""),
        fontSize: pt(parseFloat(style.fontSize)),
        lineHeight: pt(parseFloat(style.lineHeight)),
        weight: style.fontWeight,
        style: style.fontStyle,
        breakAfter: style.breakAfter,
        rule: pt(parseFloat(getComputedStyle(node, "::after").height) || 0),
        left: pt(box.left),
        right: pt(box.right),
        width: pt(box.width),
        height: pt(box.height),
        padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft]
          .map((value) => pt(parseFloat(value)))
          .join(" "),
        contentLeft: pt(box.left + parseFloat(style.paddingLeft)),
        contentRight: pt(box.right - parseFloat(style.paddingRight)),
        textLeft: pt(ink.left),
        textRight: pt(ink.right),
        firstBaselineY: firstBaseline,
        firstBaselinePdfY: Number((pageHeightPt - firstBaseline).toFixed(2)),
        lastBaselineY: lastBaseline,
        lastBaselinePdfY: Number((pageHeightPt - lastBaseline).toFixed(2)),
      });
    });
  }
  return measured;
};

const result = await withBrowser(async (endpoint) => {
  const cdp = await connect(endpoint);
  try {
    const sessionId = await openPage(cdp, url);
    const { result: value } = await cdp.send(
      "Runtime.evaluate",
      {
        expression: `(${MEASURE.toString()})(${JSON.stringify(selectors)}, ${PX_PER_PT}, ${PAGE_HEIGHT_PT})`,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId,
    );
    return value.value;
  } finally {
    cdp.close();
  }
});

const missing = result.filter((entry) => entry.missing);
for (const entry of missing) console.error(`No element matches ${entry.selector}`);

console.log(url);
console.log(JSON.stringify(result.filter((entry) => !entry.missing), null, 2));

if (missing.length > 0) process.exit(1);
