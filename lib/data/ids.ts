/**
 * Generated IDs for new library items (SPEC §6.1, §6.3).
 *
 * Everything typed in the editor is written to the content library first, with
 * a generated ID, and only then referenced by the open variant (§6.3). That ID
 * is the item's permanent identity — variants reference it and edits propagate
 * through it (§11.4) — so it must never collide with an existing one and must
 * not be derived from the text, which is the one thing about an item that is
 * expected to change.
 */
import type { ContentLibrary } from "../schema/library";

/** ID prefix per library collection, matching the seed data's shape. */
export const ID_PREFIX = {
  aboutMe: "about",
  competency: "comp",
  experience: "exp",
  project: "proj",
  education: "edu",
  skillGroup: "skills",
  skill: "skill",
  certification: "cert",
  recommendation: "rec",
  language: "lang",
  customSection: "custom",
  bullet: "bullet",
} as const;

export type IdKind = keyof typeof ID_PREFIX;

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Six random characters — enough that a collision is a curiosity, not a plan. */
export function randomSuffix(length = 6): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

/**
 * Every ID the library uses, nested ones included. Collected whole rather than
 * per collection: a bullet and a competency living in different arrays could
 * legally share an ID, but a person reading `content-library.json` — or the
 * library manager of §12.7 — should never have to work out which one a given
 * string means.
 */
export function libraryIds(library: ContentLibrary): Set<string> {
  const ids = new Set<string>();
  const add = (items: readonly { id: string }[]) => {
    for (const item of items) ids.add(item.id);
  };

  add(library.aboutMe);
  add(library.competencies);
  add(library.education);
  add(library.certifications);
  add(library.recommendations);
  add(library.languages);

  for (const entry of library.experience) {
    ids.add(entry.id);
    add(entry.bullets);
  }
  for (const entry of library.projects) {
    ids.add(entry.id);
    add(entry.bullets);
  }
  for (const group of library.skillGroups) {
    ids.add(group.id);
    add(group.skills);
  }
  for (const section of library.customSections) {
    ids.add(section.id);
    add(section.bullets);
  }

  return ids;
}

/**
 * A fresh ID of the given kind. `suffix` is injectable so tests can pin the
 * output, and so the retry loop is exercisable at all.
 */
export function generateId(
  kind: IdKind,
  taken: ReadonlySet<string>,
  suffix: () => string = randomSuffix,
): string {
  const prefix = ID_PREFIX[kind];
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const id = `${prefix}-${suffix()}`;
    if (!taken.has(id)) return id;
  }
  // Reached only if `suffix` has stopped being random. Failing loudly beats
  // handing back a duplicate, which would silently repoint an existing item.
  throw new Error(`Could not generate a unique ${prefix} id after 50 attempts`);
}
