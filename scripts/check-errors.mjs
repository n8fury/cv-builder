#!/usr/bin/env node
/**
 * SPEC §13 error-handling check.
 *
 * The rows of §13 that only exist in a running browser: a failed export has to
 * *reach the user* as a toast, the Download button has to be visibly out of
 * action while Chromium works, a bad id has to 404 rather than paint a blank
 * page, and a preview whose faces never arrive has to say so and carry on.
 * None of that is decidable from a unit test — the first two need a DOM and an
 * in-flight request, the last needs a document that really failed to load a
 * woff2.
 *
 * The remaining rows are covered where they can be decided exactly:
 * `app/api/generate-pdf/route.test.ts` provokes a broken Puppeteer and an
 * unusable face at the route, and `components/resume/ResumeSectionBody.test.tsx`
 * renders every section type curated down to nothing.
 *
 * Faults are injected from the client side — the export request is answered by
 * a stub, the woff2 requests are blocked by the browser — so the server under
 * test is the ordinary `npm run dev`, unmodified and unaware.
 *
 * Usage:
 *   node scripts/check-errors.mjs [--base http://localhost:3000]
 *                                 [--profile jordan-rivera] [--variant detailed]
 */

import { connect, openPage, withBrowser } from "./lib/chrome.mjs";

function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
}

const base = arg("base", "http://localhost:3000").replace(/\/$/, "");
const profileId = arg("profile", "jordan-rivera");
const variantId = arg("variant", "detailed");

const results = [];

/** Record one assertion under the §13 row it belongs to. */
function check(row, description, passed, detail) {
  results.push({ row, description, passed, detail });
}

/** Runtime.evaluate, with a page-side throw surfacing as a real rejection. */
async function evaluate(cdp, sessionId, expression) {
  const { result, exceptionDetails } = await cdp.send(
    "Runtime.evaluate",
    { expression, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  }
  return result.value;
}

/* ------------------------------------------------------------------ row 4 */

/**
 * "Invalid/missing profileId or variantId on /render → 404, not a blank page."
 *
 * Checked over plain HTTP: the status line *is* the behaviour, and a 200
 * carrying an empty document — the failure mode §13 names — would be invisible
 * to anything that only looked at the pixels.
 */
async function checkNotFound() {
  const cases = [
    ["an unknown profile", `/render/no-such-profile/${variantId}`],
    ["an unknown variant", `/render/${profileId}/no-such-variant`],
    ["an id the store rejects outright", `/render/${profileId}/not%20a%20slug`],
  ];

  for (const [what, path] of cases) {
    const response = await fetch(`${base}${path}`);
    check(4, `${what} → 404 from ${path}`, response.status === 404, `status ${response.status}`);
  }

  const api = await fetch(
    `${base}/api/generate-pdf?profileId=${profileId}&variantId=no-such-variant`,
  );
  const body = await api.json().catch(() => ({}));
  check(
    4,
    "the export endpoint 404s with a reason the dashboard can show",
    api.status === 404 && typeof body.error === "string" && body.error.length > 0,
    `status ${api.status}, error ${JSON.stringify(body.error ?? null)}`,
  );

  const good = await fetch(`${base}/render/${profileId}/${variantId}`);
  check(
    4,
    "a real variant still renders, so the 404s above are not blanket failures",
    good.status === 200,
    `status ${good.status}`,
  );
}

/* --------------------------------------------------------------- rows 1, 5 */

/**
 * Answers the export request with a slow failure, so the pending state lasts
 * long enough to sample, and counts the attempts so a double submit shows up.
 */
const STUB_EXPORT = `
window.__exportStub = { delayMs: 500, status: 500, error: ${JSON.stringify(
  "PDF generation failed: Failed to launch the browser process",
)} };
window.__exportRequests = 0;
const realFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (!url.includes("/api/generate-pdf")) return realFetch(input, init);
  window.__exportRequests += 1;
  const stub = window.__exportStub;
  await new Promise((resolve) => setTimeout(resolve, stub.delayMs));
  return new Response(JSON.stringify({ error: stub.error }), {
    status: stub.status,
    headers: { "Content-Type": "application/json" },
  });
};
`;

/**
 * Rows 1 and 5 together, because they are one interaction: the button goes out
 * of action for the request's duration, and what comes back — here a Puppeteer
 * launch failure, the exact 500 the route returns — arrives as a toast rather
 * than as nothing at all.
 */
const DRIVE_DOWNLOAD = `
(async () => {
  const sample = (button) => ({
    text: button.textContent.trim(),
    disabled: button.disabled,
    ariaBusy: button.getAttribute("aria-busy"),
    spinner: Boolean(button.querySelector("svg")),
  });
  const button = [...document.querySelectorAll("button")].find(
    (candidate) => candidate.textContent.trim() === "Download PDF",
  );
  if (!button) throw new Error("no Download PDF button on the dashboard");

  const idle = sample(button);
  button.click();
  // The stub takes 500ms; sample well inside that window.
  await new Promise((resolve) => setTimeout(resolve, 150));
  const inFlight = sample(button);

  // A second click while it is disabled must not start a second export.
  button.click();

  const deadline = Date.now() + 5000;
  while (button.disabled && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  // The toast is appended a tick after the fetch settles.
  await new Promise((resolve) => setTimeout(resolve, 200));

  const alert = document.querySelector('[role="alert"]');
  return {
    idle,
    inFlight,
    settled: sample(button),
    toast: alert ? alert.textContent.replace(/\\s+/g, " ").trim() : null,
    requests: window.__exportRequests,
  };
})()
`;

async function checkDownloadFailure(cdp) {
  const sessionId = await openPage(cdp, "about:blank");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: STUB_EXPORT }, sessionId);

  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${base}/` }, sessionId);
  await loaded;

  const state = await evaluate(cdp, sessionId, DRIVE_DOWNLOAD);

  check(
    5,
    "idle: the button is enabled, unbusy and unspun",
    state.idle.disabled === false && state.idle.ariaBusy === "false" && !state.idle.spinner,
    JSON.stringify(state.idle),
  );
  check(
    5,
    "in flight: disabled, aria-busy, spinner, and it says so",
    state.inFlight.disabled === true &&
      state.inFlight.ariaBusy === "true" &&
      state.inFlight.spinner &&
      state.inFlight.text.includes("Generating"),
    JSON.stringify(state.inFlight),
  );
  check(
    5,
    "a click while disabled starts no second export",
    state.requests === 1,
    `${state.requests} request(s) to /api/generate-pdf`,
  );
  check(
    5,
    "afterwards: back to its resting state, ready to retry",
    state.settled.disabled === false && state.settled.text === "Download PDF",
    JSON.stringify(state.settled),
  );
  check(
    1,
    "a failed export raises an error toast carrying the API's own reason",
    Boolean(state.toast) && state.toast.includes("Failed to launch the browser process"),
    JSON.stringify(state.toast),
  );
}

/* ------------------------------------------------------------------ row 2 */

/** The preview's half of row 2: fall back to serif, non-blocking, and say so. */
const READ_PREVIEW = `
(async () => {
  const deadline = Date.now() + 20000;
  const warningOf = () => document.querySelector("[data-font-warning]");
  while (!warningOf() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const frame = document.querySelector("iframe");
  const doc = frame ? frame.contentDocument : null;
  const heading = doc ? doc.querySelector(".resume-name, h1") : null;
  const warning = warningOf();
  return {
    warning: warning ? warning.textContent.replace(/\\s+/g, " ").trim() : null,
    fallbackClass: doc ? doc.documentElement.className : null,
    renderedFamily: heading ? getComputedStyle(heading).fontFamily : null,
    headingText: heading ? heading.textContent.trim() : null,
    editorAlive: Boolean(document.querySelector("[data-save]")),
  };
})()
`;

async function checkPreviewFallback(cdp) {
  const sessionId = await openPage(cdp, "about:blank");
  await cdp.send("Network.enable", {}, sessionId);
  // The fault: the faces never arrive, exactly as a missing build would leave
  // them — and unlike a renamed file, it is undone by closing the tab.
  await cdp.send("Network.setBlockedURLs", { urls: ["*.woff2"] }, sessionId);

  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${base}/edit/${profileId}/${variantId}` }, sessionId);
  await loaded;

  const state = await evaluate(cdp, sessionId, READ_PREVIEW);

  check(
    2,
    "the preview warns that it is showing a fallback",
    Boolean(state.warning) && /fallback serif/i.test(state.warning),
    JSON.stringify(state.warning),
  );
  check(
    2,
    "the warning also says the export will refuse — §13's split, stated",
    Boolean(state.warning) && /export will fail/i.test(state.warning),
    JSON.stringify(state.warning),
  );
  check(
    2,
    "the fallback class ends font-display: block's wait",
    (state.fallbackClass ?? "").includes("resume-fallback-fonts"),
    JSON.stringify(state.fallbackClass),
  );
  check(
    2,
    "the resume still paints — in serif, with its text intact",
    Boolean(state.headingText) && /serif/i.test(state.renderedFamily ?? ""),
    `${JSON.stringify(state.headingText)} in ${JSON.stringify(state.renderedFamily)}`,
  );
  check(
    2,
    "non-blocking: the editor is still usable",
    state.editorAlive === true,
    `save control present: ${state.editorAlive}`,
  );
}

/* -------------------------------------------------------------------- run */

const ROW_TITLES = {
  1: "Puppeteer launch/render fails → 500 + error toast",
  2: "Font file missing → preview falls back to serif, export hard-fails",
  4: "Invalid/missing profileId or variantId on /render → 404",
  5: "PDF export in progress → download disabled + spinner",
};

async function main() {
  const probe = await fetch(`${base}/`).catch(() => null);
  if (!probe?.ok) {
    console.error(`No server at ${base} — start it with \`npm run dev\` first.`);
    process.exit(2);
  }

  await withBrowser(async (endpoint) => {
    const cdp = await connect(endpoint);
    try {
      await checkNotFound();
      await checkDownloadFailure(cdp);
      await checkPreviewFallback(cdp);
    } finally {
      cdp.close();
    }
  });

  for (const row of [1, 2, 4, 5]) {
    console.log(`\n§13 row ${row} — ${ROW_TITLES[row]}`);
    for (const result of results.filter((entry) => entry.row === row)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"}  ${result.description}`);
      console.log(`        ${result.detail}`);
    }
  }

  console.log("\n§13 row 3 — Section has no visible entries → heading renders, empty body");
  console.log("  covered by components/resume/ResumeSectionBody.test.tsx (all ten section types)");
  console.log("§13 rows 1 and 2, server side — covered by app/api/generate-pdf/route.test.ts");

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exit(1);
}

await main();
