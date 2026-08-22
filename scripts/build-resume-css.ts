/**
 * Rewrites the generated :root block in components/resume/resume.css from
 * lib/render/metrics.ts. Run after changing any measured value — `npm test`
 * fails if the committed stylesheet is stale.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { withGeneratedBlock } from "../lib/render/css-variables";

const file = join(process.cwd(), "components", "resume", "resume.css");
const current = readFileSync(file, "utf8");
const next = withGeneratedBlock(current);

if (next === current) {
  console.log("resume.css already up to date");
} else {
  writeFileSync(file, next, "utf8");
  console.log(`updated ${relative(process.cwd(), file)}`);
}
