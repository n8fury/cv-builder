/**
 * The library IDs a variant references (SPEC §6.2, §11.4, §12.3).
 *
 * A variant is nothing but references and order, so two questions come up
 * repeatedly: which IDs does it name, and what does it look like with one ID
 * swapped for another. Fork (§11.4) needs the swap on exactly one variant;
 * orphan detection (§7) needs the union of the names across all of them.
 *
 * Both walk the same section shapes, so they live together — a section type
 * added to the schema and handled in one but not the other would make a fork
 * lose a reference or an orphan check report a live item as unused.
 */
import { variantSchema, type Variant, type VariantSection } from "../schema/variant";

/** Rewrites every reference in one section through `swap`. */
function mapSection(section: VariantSection, swap: (id: string) => string): VariantSection {
  switch (section.type) {
    case "header":
    case "languages":
      // Neither references a library item: the header is a single record on
      // the library (§5.1) and Languages is `visible`-only (§12.3, §15.6).
      return section;

    case "aboutMe":
      return { ...section, options: { aboutMeId: swap(section.options.aboutMeId) } };

    case "custom":
      return { ...section, options: { customSectionId: swap(section.options.customSectionId) } };

    case "competencies":
      return { ...section, items: section.items.map(swap) };

    case "experience":
    case "projects":
      return {
        ...section,
        entries: section.entries.map((entry) => ({
          id: swap(entry.id),
          bullets: entry.bullets.map(swap),
        })),
      };

    case "education":
    case "certifications":
    case "recommendations":
      return { ...section, entries: section.entries.map((entry) => ({ id: swap(entry.id) })) };

    case "skills":
      return {
        ...section,
        groups: section.groups.map((group) => ({
          id: swap(group.id),
          skills: group.skills.map(swap),
        })),
      };
  }
}

/**
 * A copy of the variant with every reference passed through `swap`. Curation
 * and order are untouched — a fork changes which item a slot points at, never
 * which slots exist or where they sit (§15.3).
 */
export function mapVariantRefs(variant: Variant, swap: (id: string) => string): Variant {
  return variantSchema.parse({
    ...variant,
    sections: variant.sections.map((section) => mapSection(section, swap)),
  });
}

/** Repoints only the IDs named in `replacements`, leaving the rest alone. */
export function repointVariant(variant: Variant, replacements: ReadonlyMap<string, string>): Variant {
  return mapVariantRefs(variant, (id) => replacements.get(id) ?? id);
}

/** Every library ID this variant names, at any level. */
export function variantReferencedIds(variant: Variant): Set<string> {
  const ids = new Set<string>();
  mapVariantRefs(variant, (id) => {
    ids.add(id);
    return id;
  });
  return ids;
}

/**
 * The IDs a variant names that the library cannot satisfy (§10, §13).
 *
 * `resolveVariant` already refuses to render a dangling reference, but it
 * throws on the first one it meets, which is the wrong shape for the drafting
 * API: an LLM that has invented content tends to invent several IDs at once,
 * and telling it about one per round trip wastes a round trip each time. This
 * reports all of them, in the order the variant names them, so a rejection can
 * name the whole set (§10: the model may only select from what exists).
 */
export function danglingRefs(variant: Variant, known: ReadonlySet<string>): string[] {
  const missing: string[] = [];
  mapVariantRefs(variant, (id) => {
    if (!known.has(id) && !missing.includes(id)) missing.push(id);
    return id;
  });
  return missing;
}
