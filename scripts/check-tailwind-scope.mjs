// Verifies SPEC §7: Tailwind generates CSS for editor chrome only. A probe
// class is written into components/editor and components/resume, the
// stylesheet is compiled, and the resume class must be absent.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const probes = [
  { dir: "components/editor", cls: "bg-lime-300", expected: true },
  { dir: "components/resume", cls: "bg-fuchsia-300", expected: false },
];
const probeFile = "__tailwind-scope-probe.tsx";

for (const { dir, cls } of probes) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${probeFile}`, `export const probe = "${cls}";\n`);
}

let css;
try {
  const from = "app/globals.css";
  const result = await postcss([tailwind()]).process(await readFile(from, "utf8"), { from });
  css = result.css;
} finally {
  for (const { dir } of probes) rmSync(`${dir}/${probeFile}`, { force: true });
}

let failed = false;
for (const { dir, cls, expected } of probes) {
  const found = css.includes(cls);
  const ok = found === expected;
  failed ||= !ok;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${dir}/**  ${cls}  ` +
      `${found ? "generated" : "not generated"} (expected ${expected ? "generated" : "not generated"})`,
  );
}

if (failed) {
  console.error("Tailwind scope check failed — see app/globals.css @source rules.");
  process.exit(1);
}
