/**
 * The section jump rail's contents (SPEC §7, §15.3).
 *
 * The editor's left column does not collapse: a section's rows stay on screen
 * whether or not the section is visible, because curation is usually prepared
 * before a section is switched back on and a card that folded away would
 * shuffle the whole column on every toggle. The cost of that decision is
 * distance — on a real profile the form is several screens tall — and this is
 * what pays it back: one row of chips naming every section, each one a click
 * away from its card.
 *
 * Everything here is derivation, not state. The rail's order *is* the
 * variant's order (§15.3), its labels are the headings the CV prints, and its
 * chips are the cards the form is currently showing — so a filtered column
 * gets a filtered rail rather than a chip that jumps nowhere. Pressing one
 * changes nothing about the draft; there is no store action in this file.
 *
 * A card is addressed by the same `sectionKeys` key the drag uses, turned into
 * a DOM id. Sections have no id of their own — array position is their
 * identity — and a bare index changes under every reorder, so the key is what
 * survives a drag between the rail being drawn and a chip being pressed.
 */
import { SECTION_TITLE } from "@/lib/render/section-titles";
import type { ContentLibrary } from "@/lib/schema/library";
import type { VariantSection } from "@/lib/schema/variant";

export interface RailItem {
  /** `sectionKeys` key — `experience#0`. Stable across a reorder. */
  key: string;
  /** The card's DOM id, which is what a jump resolves against. */
  id: string;
  /** Position in the *full* sections array, filtered-out cards included. */
  index: number;
  title: string;
  type: VariantSection["type"];
  visible: boolean;
}

/**
 * What the card and the chip both call a section. The fixed types take the
 * heading the CV prints, so the two columns read the same way down the page; a
 * custom section carries its own title on the library item it points at
 * (§12.4), and an unnamed or broken pointer still has to say something.
 */
export function sectionLabel(section: VariantSection, library: ContentLibrary): string {
  if (section.type === "header") return "Header";
  if (section.type === "custom") {
    const found = library.customSections.find((item) => item.id === section.options.customSectionId);
    const title = found?.title.trim();
    return title ? title : "Custom section";
  }
  return SECTION_TITLE[section.type];
}

/** `experience#0` → `section-experience-0`, unique because the key is. */
export function sectionDomId(key: string): string {
  return `section-${key.replace("#", "-")}`;
}

/**
 * One chip per card on screen, in the variant's order. `shown` is the form's
 * own filtered list, carrying each section's index in the full array, so the
 * rail and the column can never disagree about what is there to jump to.
 */
export function railItems(
  shown: readonly { section: VariantSection; index: number }[],
  keys: readonly string[],
  library: ContentLibrary,
): RailItem[] {
  return shown.map(({ section, index }) => ({
    key: keys[index],
    id: sectionDomId(keys[index]),
    index,
    title: sectionLabel(section, library),
    type: section.type,
    visible: section.visible,
  }));
}
