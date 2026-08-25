/**
 * The drafting system prompt and the catalogue it draws from (SPEC §10).
 *
 * §10 allows the LLM node exactly one job: pick library IDs that suit a job
 * description and put them in a sensible order. It may not write content —
 * every word on the finished CV was written by the person it belongs to, and
 * a model that quietly invents a metric produces a document that is a lie
 * about someone's career, which is a far worse failure than an empty section.
 *
 * The prompt lives here rather than inside the n8n workflow JSON so it is
 * reviewable in the repo and testable: `prompt.test.ts` holds it to the
 * prohibition, and `POST /api/variants` enforces the same rule on the way in,
 * because a prompt is a request and the write path is where it is settled.
 */
import type { ContentLibrary } from "../schema/library";
import { indexLibrary } from "../data/library-index";
import { SECTION_TYPES } from "../schema/variant";

/**
 * What the model is allowed to do, in the imperative, with the prohibition
 * stated as a rule rather than a preference. The variant shape it must emit is
 * described in terms of the schema the endpoint validates against, so a draft
 * that satisfies the prompt is a draft the endpoint accepts.
 */
export const DRAFT_SYSTEM_PROMPT = `You are drafting a CV variant for a specific job application.

A variant is pure curation. It contains no text of its own — only IDs from the
candidate's content library, arranged in the order they should appear.

You may ONLY:
- select which library IDs to include;
- order the sections, entries, bullets and skills you selected;
- set each section's visibility and its options (header mode, About Me
  version, recommendations mode).

You must NOT:
- invent experience, employers, job titles, dates, projects, education,
  certifications or skills;
- invent metrics, numbers, percentages or outcomes of any kind;
- invent, rewrite, summarise, translate or otherwise alter the wording of any
  library item — you are not emitting text, only IDs;
- emit any ID that does not appear verbatim in the library catalogue given to
  you. Every ID you emit is checked against the library and the whole draft is
  rejected if even one is unknown.

If the job description asks for something the candidate's library does not
cover, leave it out. An honest, shorter CV is the correct answer; a fabricated
qualification is never acceptable, however well it matches the posting.

Prefer entries and bullets whose wording or tags already match the target role,
and lead with them. Keep the CV to the strongest material rather than including
everything available.

Respond with JSON only, no prose and no code fence:

{
  "tag": "<short slug-able label for this application, e.g. 'acme-backend'>",
  "label": "<one-line human description of the variant>",
  "sections": [ ... ]
}

Each section is one of the following shapes, and "type" must be one of:
${SECTION_TYPES.join(", ")}.

  { "type": "header", "visible": true, "options": { "mode": "full" | "minimal" } }
  { "type": "aboutMe", "visible": true, "options": { "aboutMeId": "<id>" } }
  { "type": "competencies", "visible": true, "options": {}, "items": ["<id>", ...] }
  { "type": "experience", "visible": true, "options": {},
    "entries": [ { "id": "<id>", "bullets": ["<id>", ...] } ] }
  { "type": "projects", "visible": true, "options": {},
    "entries": [ { "id": "<id>", "bullets": ["<id>", ...] } ] }
  { "type": "education", "visible": true, "options": { }, "entries": [ { "id": "<id>" } ] }
  { "type": "skills", "visible": true, "options": {},
    "groups": [ { "id": "<id>", "skills": ["<id>", ...] } ] }
  { "type": "certifications", "visible": true, "options": {}, "entries": [ { "id": "<id>" } ] }
  { "type": "languages", "visible": true, "options": {} }
  { "type": "recommendations", "visible": true,
    "options": { "mode": "collapsed" | "expanded" }, "entries": [ { "id": "<id>" } ] }
  { "type": "custom", "visible": true, "options": { "customSectionId": "<id>" } }

Section order in the array is the order they render. Include a section only if
you want it in this variant; omitting it is the same as leaving it out.`;

/**
 * The library as the model sees it: one line per item, `id — text`, nested
 * children indented under their entry, tags appended when the item has any.
 *
 * Derived from `indexLibrary` rather than walked by hand, so a collection
 * added to the schema reaches the catalogue the same day it reaches the
 * library manager — a kind the model never hears about is a kind it can never
 * select, which would look like the model ignoring half the CV.
 */
export function libraryDigest(library: ContentLibrary): string {
  const lines: string[] = [];

  for (const group of indexLibrary(library)) {
    if (group.items.length === 0) continue;
    lines.push(`## ${group.label}`);
    for (const item of group.items) {
      lines.push(describe(item, 0));
      for (const child of item.children) lines.push(describe(child, 1));
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function describe(item: { id: string; title: string; tags: string[] }, depth: number): string {
  const indent = "  ".repeat(depth);
  const tags = item.tags.length > 0 ? `  [tags: ${item.tags.join(", ")}]` : "";
  return `${indent}${item.id} — ${item.title}${tags}`;
}

/**
 * The user-turn message for one application: the catalogue, then the posting.
 * Kept beside the system prompt because the two are one contract — the prompt
 * promises the model a catalogue in exactly this shape.
 */
export function draftUserMessage(
  library: ContentLibrary,
  targetRole: string,
  jobDescription: string,
): string {
  return [
    "# Library catalogue — the only IDs you may use",
    "",
    libraryDigest(library),
    "",
    `# Target role`,
    targetRole,
    "",
    "# Job description",
    jobDescription,
  ].join("\n");
}
