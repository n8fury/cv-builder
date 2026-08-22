/**
 * Measures the rendered resume page in a real browser.
 *
 * The whole project is a geometry claim, so "the CSS says 55pt" is not
 * evidence — only a laid-out box is. This drives a headless Chrome over the
 * DevTools protocol (no Puppeteer yet; that arrives with the export path in
 * SPEC §8) and prints the measured page box, its padding, and the content
 * box's left and right edges, all converted back into points.
 *
 * Baselines are measured, not inferred: a zero-sized inline-block probe is
 * appended to each element, and its bottom edge sits exactly on that
 * element's last baseline. Positions are reported both from the top of the
 * document and as PDF-style y (up from the page bottom), so they can be read
 * straight against SPEC §4's coordinates.
 *
 * Usage: node scripts/measure-render.mjs [url] [comma-separated selectors]
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PX_PER_PT = 96 / 72;
const PAGE_HEIGHT_PT = 792;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const url = process.argv[2] ?? "http://localhost:3000/render/jordan-rivera/detailed";
const selectors = (process.argv[3] ?? ".resume-page,.resume-name,.resume-contact")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

function chromeBinary() {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `No Chrome found. Set CHROME_PATH. Tried:\n  ${CHROME_CANDIDATES.join("\n  ")}`,
    );
  }
  return found;
}

/** The measurement itself, evaluated in the page. Returns points, not pixels. */
const MEASURE = (selectorList, pxPerPt, pageHeightPt) => {
  const pt = (value) => Number((value / pxPerPt).toFixed(2));

  /* A zero-sized inline-block aligns its bottom margin edge to the baseline
     of the line it lands on — the only way to read a baseline out of the DOM. */
  const lastBaseline = (node) => {
    const probe = document.createElement("span");
    probe.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    node.appendChild(probe);
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
      const baseline = pt(lastBaseline(node));
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
        lastBaselineY: baseline,
        lastBaselinePdfY: Number((pageHeightPt - baseline).toFixed(2)),
      });
    });
  }
  return measured;
};

async function withBrowser(run) {
  const profile = await mkdtemp(join(tmpdir(), "cv-measure-"));
  const chrome = spawn(
    chromeBinary(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  const endpoint = await new Promise((resolve, reject) => {
    let buffered = "";
    const timer = setTimeout(() => reject(new Error("Chrome never reported a debug port")), 20000);
    chrome.stderr.on("data", (chunk) => {
      buffered += chunk;
      const match = buffered.match(/ws:\/\/[^\s]+/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    });
    chrome.on("exit", (code) => reject(new Error(`Chrome exited early (${code})`)));
  });

  try {
    return await run(endpoint);
  } finally {
    const exited = new Promise((resolve) => chrome.on("exit", resolve));
    chrome.kill();
    await exited;
    // Windows can still hold the profile lock for a moment after exit; the
    // temp dir is disposable, so a failed cleanup must not fail the run.
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }).catch(
      () => {},
    );
  }
}

/** Minimal CDP client: enough to open a tab, navigate, and evaluate. */
async function connect(endpoint) {
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("CDP connection failed")), {
      once: true,
    });
  });

  let nextId = 0;
  const pending = new Map();
  const events = new Set();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id !== undefined) {
      const settle = pending.get(message.id);
      pending.delete(message.id);
      if (settle && message.error) settle.reject(new Error(message.error.message));
      else if (settle) settle.resolve(message.result);
      return;
    }
    for (const listener of events) listener(message);
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

  const once = (method) =>
    new Promise((resolve) => {
      const listener = (message) => {
        if (message.method === method) {
          events.delete(listener);
          resolve(message.params);
        }
      };
      events.add(listener);
    });

  return { send, once, close: () => socket.close() };
}

const result = await withBrowser(async (endpoint) => {
  const cdp = await connect(endpoint);
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    const loaded = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url }, sessionId);
    await loaded;
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
