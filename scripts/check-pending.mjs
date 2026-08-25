#!/usr/bin/env node
/**
 * Pending-state check for the dashboard, the editor and the library manager
 * (SPEC §7, §13).
 *
 * Every screen in the app is `force-dynamic` and reads the profile off disk,
 * so every navigation and every action here is a real round trip. Two things
 * have to hold for all of them: something visibly changes the moment you
 * click, and clicking again while it works cannot start the same thing twice.
 * Neither is decidable without a DOM and a real request in flight, which is
 * what this drives.
 *
 * Requests are slowed with CCP-level latency rather than a stubbed `fetch`, so
 * what is being timed is the real navigation and the real server action — the
 * only thing the check changes is how long the network takes. Clicks are
 * counted from `Network.requestWillBeSent`, so a double submit shows up
 * whatever the client used to send it.
 *
 * Mutating checks run entirely inside a profile this script creates and then
 * deletes. Point the server at a scratch data directory to be certain nothing
 * else can be touched:
 *
 *   CV_PROFILES_DIR=/tmp/cv-scratch npm run dev
 *   node scripts/check-pending.mjs
 *
 * Usage:
 *   node scripts/check-pending.mjs [--base http://localhost:3000]
 *                                  [--profile jordan-rivera] [--variant detailed]
 */

import { connect, openPage, withBrowser } from "./lib/chrome.mjs";

function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
}

const base = arg("base", "http://localhost:3000").replace(/\/$/, "");
const profileId = arg("profile", "jordan-rivera");
const variantId = arg("variant", "detailed");

/** The throwaway profile the mutating checks act on, created and deleted here. */
const TEMP_ID = "pending-check-tmp";
const TEMP_RENAMED = "pending-check-tmp2";

/** Enough latency that a pending state lasts long enough to sample. */
const LATENCY_MS = 400;

const results = [];

function check(screen, description, passed, detail) {
  results.push({ screen, description, passed, detail });
}

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

/* ---------------------------------------------------------------- page-side */

/**
 * Helpers installed into every document: finding a control by its text, and
 * sampling the two things that matter — what it says and whether it is out of
 * action.
 */
const HELPERS = `
window.__byText = (text, selector) =>
  [...document.querySelectorAll(selector || "button, a")].find(
    (node) => node.textContent.trim() === text,
  );
window.__within = (root, text, selector) =>
  [...root.querySelectorAll(selector || "button, a")].find(
    (node) => node.textContent.trim().startsWith(text),
  );
window.__card = (id) =>
  [...document.querySelectorAll("section")].find((node) => node.textContent.includes(id));
window.__sample = (node) => ({
  text: node.textContent.trim(),
  disabled: node.disabled === true,
  ariaBusy: node.getAttribute("aria-busy"),
  spinner: Boolean(node.querySelector("[data-pending], svg")),
});
window.__settle = async (test, ms) => {
  const deadline = Date.now() + (ms || 10000);
  while (!test() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return test();
};
`;

/* -------------------------------------------------------------------- setup */

/** Counts requests the page issues, so a double submit is visible. */
function countRequests(cdp) {
  const seen = [];
  const off = cdp.on("Network.requestWillBeSent", ({ request }) => {
    seen.push({ method: request.method, url: request.url });
  });
  return {
    stop: off,
    reset: () => (seen.length = 0),
    posts: () => seen.filter((entry) => entry.method === "POST").length,
    documents: () => seen.filter((entry) => entry.method === "GET").length,
  };
}

async function newSession(cdp) {
  const sessionId = await openPage(cdp, "about:blank");
  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: HELPERS }, sessionId);
  await cdp.send(
    "Network.emulateNetworkConditions",
    {
      offline: false,
      latency: LATENCY_MS,
      downloadThroughput: -1,
      uploadThroughput: -1,
    },
    sessionId,
  );
  return sessionId;
}

async function goto(cdp, sessionId, path) {
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url: `${base}${path}` }, sessionId);
  await loaded;
  // Every control here is a client component, and clicking one before React
  // has hydrated submits the *form* — a plain GET that reloads the page and
  // measures nothing. `window.next` appears with the client bundle, which is
  // the earliest honest signal that the page is interactive.
  const ready = await evaluate(
    cdp,
    sessionId,
    `window.__settle(() => Boolean(window.next) && document.readyState === "complete", 30000)`,
  );
  if (!ready) throw new Error(`page at ${path} never became interactive`);
  await evaluate(cdp, sessionId, `new Promise((resolve) => setTimeout(resolve, 300))`);
}

/* ---------------------------------------------------------------- navigation */

/**
 * A link that goes somewhere slow has to say so twice: on the link itself, the
 * instant it is clicked, and then as the shape of the screen being fetched.
 */
async function checkNavigation(cdp, sessionId) {
  const state = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      const link = window.__byText("Edit", "a");
      link.click();
      await window.__settle(() => document.querySelector("[data-pending]"), 3000);
      const indicator = Boolean(document.querySelector("[data-pending]"));
      const skeleton = await window.__settle(
        () => Boolean(document.querySelector("[data-loading]")),
        8000,
      );
      const label = document.querySelector("[data-loading] .sr-only");
      const arrived = await window.__settle(
        () => Boolean(document.querySelector("[data-save]")),
        20000,
      );
      return {
        indicator,
        skeleton,
        label: label ? label.textContent.trim() : null,
        arrived,
      };
    })()`,
  );

  check(
    "dashboard",
    "the Edit link shows a pending indicator the moment it is clicked",
    state.indicator === true,
    `data-pending present: ${state.indicator}`,
  );
  check(
    "editor",
    "the editor's loading skeleton stands in while the variant is read",
    state.skeleton === true && /editor/i.test(state.label ?? ""),
    `skeleton: ${state.skeleton}, announced as ${JSON.stringify(state.label)}`,
  );
  check(
    "editor",
    "and the real editor replaces it",
    state.arrived === true,
    `save control present: ${state.arrived}`,
  );
}

/** The manager's own navigations: the tag chips and the fork-scope Apply. */
async function checkLibraryNavigation(cdp, sessionId, requests) {
  await goto(cdp, sessionId, `/library/${profileId}`);

  requests.reset();
  const scope = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      const button = document.querySelector("[data-apply-scope]");
      if (!button) throw new Error("no Apply control on the library manager");
      const select = document.querySelector("#variant-scope");
      select.value = ${JSON.stringify(variantId)};
      const idle = window.__sample(button);
      button.click();
      await window.__settle(() => button.disabled, 3000);
      const inFlight = window.__sample(button);
      // Second click while it works: must not start a second navigation.
      button.click();
      await window.__settle(() => !button.disabled, 20000);
      return { idle, inFlight, settled: window.__sample(button), url: location.search };
    })()`,
  );

  check(
    "library",
    "Apply is idle before it is pressed",
    scope.idle.disabled === false && scope.idle.text === "Apply",
    JSON.stringify(scope.idle),
  );
  check(
    "library",
    "Apply says 'Applying…' and disables while the library is re-read",
    scope.inFlight.disabled === true &&
      scope.inFlight.ariaBusy === "true" &&
      scope.inFlight.text.includes("Applying"),
    JSON.stringify(scope.inFlight),
  );
  check(
    "library",
    "the scope really applied, and the button came back",
    scope.settled.disabled === false && scope.url.includes(`variant=${variantId}`),
    `${JSON.stringify(scope.settled)} at ${JSON.stringify(scope.url)}`,
  );

  const chip = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      const chips = [...document.querySelectorAll("a")].filter((node) =>
        node.getAttribute("href")?.includes("tag="),
      );
      if (chips.length === 0) return { skipped: true };
      chips[0].click();
      const indicator = await window.__settle(
        () => Boolean(document.querySelector("[data-pending]")),
        3000,
      );
      await window.__settle(() => location.search.includes("tag="), 20000);
      return { skipped: false, indicator, url: location.search };
    })()`,
  );

  if (chip.skipped) {
    check("library", "tag chips — none in this library, nothing to check", true, "no tags");
  } else {
    check(
      "library",
      "a tag chip shows a pending indicator while the filter is applied",
      chip.indicator === true,
      `data-pending: ${chip.indicator}, url ${JSON.stringify(chip.url)}`,
    );
    check(
      "library",
      "the tag filter keeps the fork scope it was applied over",
      chip.url.includes(`variant=${variantId}`),
      JSON.stringify(chip.url),
    );
  }
}

/* ----------------------------------------------------------------- mutations */

/**
 * Create, rename and delete, on a profile this script owns. Each one is a
 * server action: the button has to change and lock for its duration, and a
 * second click has to reach nothing.
 */
async function checkProfileActions(cdp, sessionId, requests) {
  await goto(cdp, sessionId, "/");

  requests.reset();
  const created = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      const form = document.querySelector("form");
      const setValue = (name, value) => {
        const field = form.querySelector('[name="' + name + '"]');
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        ).set;
        setter.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      };
      setValue("name", "Pending Check");
      setValue("profileId", ${JSON.stringify(TEMP_ID)});
      const button = window.__byText("Create profile");
      const idle = window.__sample(button);
      button.click();
      await window.__settle(() => button.disabled, 3000);
      const inFlight = window.__sample(button);
      button.click();
      await window.__settle(() => Boolean(window.__card(${JSON.stringify(TEMP_ID)})), 20000);
      const failure = document.querySelector("form p.text-red-700");
      return {
        idle,
        inFlight,
        created: Boolean(window.__card(${JSON.stringify(TEMP_ID)})),
        error: failure ? failure.textContent.trim() : null,
      };
    })()`,
  );

  check(
    "dashboard",
    "New profile: the submit locks and says 'Creating…'",
    created.inFlight.disabled === true && created.inFlight.text.includes("Creating"),
    `${JSON.stringify(created.idle)} → ${JSON.stringify(created.inFlight)}`,
  );
  check(
    "dashboard",
    "a second click while creating posts nothing extra",
    requests.posts() === 1,
    `${requests.posts()} POST(s)`,
  );
  check(
    "dashboard",
    "the profile was created",
    created.created === true,
    created.error ? `refused: ${created.error}` : `${TEMP_ID} on screen`,
  );
  if (!created.created) throw new Error(`could not create ${TEMP_ID}: ${created.error ?? "no error shown"}`);

  requests.reset();
  const renamed = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      const card = window.__card(${JSON.stringify(TEMP_ID)});
      window.__within(card, "Rename").click();
      await window.__settle(() => Boolean(card.querySelector('[name="nextId"]')), 3000);
      const field = card.querySelector('[name="nextId"]');
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(field, ${JSON.stringify(TEMP_RENAMED)});
      field.dispatchEvent(new Event("input", { bubbles: true }));
      const button = window.__within(card, "Save");
      button.click();
      await window.__settle(() => button.disabled, 3000);
      const inFlight = { ...window.__sample(button), fieldDisabled: field.disabled };
      button.click();
      await window.__settle(() => Boolean(window.__card(${JSON.stringify(TEMP_RENAMED)})), 20000);
      return { inFlight, renamed: Boolean(window.__card(${JSON.stringify(TEMP_RENAMED)})) };
    })()`,
  );

  check(
    "dashboard",
    "Rename: the submit locks, says 'Saving…', and the field locks with it",
    renamed.inFlight.disabled === true &&
      renamed.inFlight.text.includes("Saving") &&
      renamed.inFlight.fieldDisabled === true,
    JSON.stringify(renamed.inFlight),
  );
  check(
    "dashboard",
    "a second click while saving posts nothing extra",
    requests.posts() === 1,
    `${requests.posts()} POST(s)`,
  );
  check("dashboard", "the profile was renamed", renamed.renamed === true, `${TEMP_RENAMED} on screen`);

  requests.reset();
  const deleted = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      // The confirmation is the point of the button (§15.12); auto-accept it
      // so what is being measured is the request that follows.
      window.confirm = () => true;
      const card = window.__card(${JSON.stringify(TEMP_RENAMED)});
      const button = window.__within(card, "Delete");
      button.click();
      await window.__settle(() => button.disabled, 3000);
      const inFlight = window.__sample(button);
      button.click();
      await window.__settle(() => !window.__card(${JSON.stringify(TEMP_RENAMED)}), 20000);
      return { inFlight, gone: !window.__card(${JSON.stringify(TEMP_RENAMED)}) };
    })()`,
  );

  check(
    "dashboard",
    "Delete: the button locks and says 'Deleting…'",
    deleted.inFlight.disabled === true && deleted.inFlight.text.includes("Deleting"),
    JSON.stringify(deleted.inFlight),
  );
  check(
    "dashboard",
    "a second click while deleting posts nothing extra",
    requests.posts() === 1,
    `${requests.posts()} POST(s)`,
  );
  check("dashboard", "the throwaway profile is gone again", deleted.gone === true, "card removed");
}

/** Editing a library item: the same contract, on the manager's own form. */
async function checkLibraryItemSave(cdp, sessionId, requests) {
  await goto(cdp, sessionId, `/library/${profileId}`);

  requests.reset();
  const saved = await evaluate(
    cdp,
    sessionId,
    `(async () => {
      // Item rows are collapsed by default (the library holds everything ever
      // written); the form is inside the first one.
      const row = document.querySelector("details");
      if (!row) return { skipped: "no item in this library" };
      row.open = true;
      await window.__settle(() => Boolean(row.querySelector('[name="tags"]')), 5000);
      const form = row.querySelector('[name="tags"]').closest("form");
      const button = window.__within(form, "Save");
      const idle = window.__sample(button);
      // Submitted unchanged: this is about the pending state, not the write.
      button.click();
      await window.__settle(() => button.disabled, 3000);
      const inFlight = window.__sample(button);
      button.click();
      await window.__settle(() => !button.disabled, 20000);
      return { skipped: null, idle, inFlight };
    })()`,
  );

  if (saved.skipped) {
    check("library", `item form — skipped (${saved.skipped})`, true, saved.skipped);
    return;
  }

  check(
    "library",
    "Save on a library item locks and says 'Saving…'",
    saved.inFlight.disabled === true && saved.inFlight.text.includes("Saving"),
    `${JSON.stringify(saved.idle)} → ${JSON.stringify(saved.inFlight)}`,
  );
  check(
    "library",
    "a second click while saving posts nothing extra",
    requests.posts() === 1,
    `${requests.posts()} POST(s)`,
  );
}

/* -------------------------------------------------------------------- run */

async function main() {
  const probe = await fetch(`${base}/`).catch(() => null);
  if (!probe?.ok) {
    console.error(`No server at ${base} — start it with \`npm run dev\` first.`);
    process.exit(2);
  }

  await withBrowser(async (endpoint) => {
    const cdp = await connect(endpoint);
    const requests = countRequests(cdp);
    try {
      const sessionId = await newSession(cdp);
      await goto(cdp, sessionId, "/");
      // One failing screen must not hide the others' results.
      for (const [screen, run] of [
        ["dashboard", () => checkNavigation(cdp, sessionId)],
        ["library", () => checkLibraryNavigation(cdp, sessionId, requests)],
        ["library", () => checkLibraryItemSave(cdp, sessionId, requests)],
        ["dashboard", () => checkProfileActions(cdp, sessionId, requests)],
      ]) {
        try {
          await run();
        } catch (error) {
          check(screen, "check crashed", false, error instanceof Error ? error.message : String(error));
        }
      }
    } finally {
      requests.stop();
      cdp.close();
    }
  });

  for (const screen of ["dashboard", "editor", "library"]) {
    const rows = results.filter((entry) => entry.screen === screen);
    if (rows.length === 0) continue;
    console.log(`\n${screen}`);
    for (const result of rows) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"}  ${result.description}`);
      console.log(`        ${result.detail}`);
    }
  }

  console.log(
    "\nAlso covered elsewhere: the Download button's spinner and the export toast in " +
      "scripts/check-errors.mjs; Save / Save As are in-editor and stage to memory until pressed.",
  );

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) process.exit(1);
}

await main();
