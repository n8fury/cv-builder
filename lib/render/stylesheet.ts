/**
 * The resume stylesheet as text, for the editor preview (SPEC §7, §8).
 *
 * The preview renders the resume inside an iframe so the editor's Tailwind
 * chrome — preflight included — cannot reach it, exactly as the `(resume)`
 * root layout keeps it away from the print route. An iframe document gets no
 * stylesheet from Next's module graph, so the same two files that layout
 * imports are read off disk and injected verbatim. Reading them (rather than
 * copying values into a second stylesheet) is the point: the preview and the
 * PDF must never diverge.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FILES = ["fonts.css", "resume.css"];

let cached: Promise<string> | null = null;

/** Concatenated `fonts.css` + `resume.css`, read once per server process. */
export function resumeStylesheet(): Promise<string> {
  cached ??= Promise.all(
    FILES.map((file) => readFile(join(process.cwd(), "components", "resume", file), "utf8")),
  ).then((parts) => parts.join("\n"));
  return cached;
}
