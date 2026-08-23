/**
 * Minimal headless-Chrome driver over the DevTools protocol.
 *
 * Shared by the measurement script and the fidelity harness. Puppeteer is
 * deliberately not used here — it arrives with the export path in SPEC §8, and
 * the harness has to be able to gate that work rather than depend on it.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

export function chromeBinary() {
  const found = CHROME_CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `No Chrome found. Set CHROME_PATH. Tried:\n  ${CHROME_CANDIDATES.join("\n  ")}`,
    );
  }
  return found;
}

/** Launch Chrome, hand `run` its debug endpoint, and always tear it down. */
export async function withBrowser(run) {
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
export async function connect(endpoint) {
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

/** Open `url` in a fresh tab, wait for load, and return its attached session. */
export async function openPage(cdp, url) {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  await cdp.send("Page.enable", {}, sessionId);
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url }, sessionId);
  await loaded;
  return sessionId;
}
