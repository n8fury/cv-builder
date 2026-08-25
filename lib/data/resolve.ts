/**
 * Variant → library resolver (SPEC §6.2, §12.3).
 *
 * A variant holds nothing but IDs and ordering; the render layer wants text.
 * `resolveVariant` walks the variant's section list in array order (§15.3),
 * looks every reference up in the content library, and returns a flat render
 * model with no IDs left to chase.
 *
 * Curated order is the *variant's* order, never the library's — the variant is
 * what drag-to-reorder rewrites. A reference the library cannot satisfy throws
 * rather than rendering a silently shortened CV.
 */
import type {
  Certification,
  ContentLibrary,
  Header,
  Language,
  Recommendation,
} from "../schema/library";
import type { HeaderMode, RecommendationsMode, Variant, VariantSection } from "../schema/variant";

/** A variant references a library ID that no longer exists. */
export class UnknownReferenceError extends Error {
  override readonly name = "UnknownReferenceError";

  constructor(
    readonly kind: string,
    readonly id: string,
  ) {
    super(`Variant references unknown ${kind}: ${JSON.stringify(id)}`);
  }
}

export interface ResolvedBullet {
  id: string;
  text: string;
}

export interface ResolvedEntry {
  id: string;
  bullets: ResolvedBullet[];
}

export interface ResolvedExperience extends ResolvedEntry {
  title: string;
  company: string;
  location: string;
  dates: string;
}

export interface ResolvedProject extends ResolvedEntry {
  title: string;
  subtitle: string;
  dates: string;
  repoUrl: string | null;
  demoUrl: string | null;
}

export interface ResolvedEducation {
  id: string;
  institution: string;
  degree: string;
  dates: string;
  description: string;
}

export interface ResolvedSkillGroup {
  id: string;
  label: string;
  skills: ResolvedBullet[];
}

export interface ResolvedCustomSection {
  id: string;
  title: string;
  paragraph: string | null;
  bullets: ResolvedBullet[];
}

export type ResolvedSection =
  | { type: "header"; mode: HeaderMode; showTitle: boolean; header: Header }
  | { type: "aboutMe"; id: string; text: string }
  | { type: "competencies"; items: ResolvedBullet[] }
  | { type: "experience"; splitEntries: boolean; entries: ResolvedExperience[] }
  | { type: "projects"; splitEntries: boolean; entries: ResolvedProject[] }
  | { type: "education"; entries: ResolvedEducation[] }
  | { type: "skills"; groups: ResolvedSkillGroup[] }
  | { type: "certifications"; entries: Certification[] }
  | { type: "languages"; entries: Language[] }
  | { type: "recommendations"; mode: RecommendationsMode; entries: Recommendation[] }
  | { type: "custom"; section: ResolvedCustomSection };

export interface RenderModel {
  tag: string;
  label: string;
  sections: ResolvedSection[];
}

function index<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function pick<T>(source: Map<string, T>, id: string, kind: string): T {
  const found = source.get(id);
  if (found === undefined) throw new UnknownReferenceError(kind, id);
  return found;
}

function pickAll<T>(source: Map<string, T>, ids: readonly string[], kind: string): T[] {
  return ids.map((id) => pick(source, id, kind));
}

function toBullets(
  source: Map<string, { id: string; text: string }>,
  ids: readonly string[],
  kind: string,
): ResolvedBullet[] {
  return pickAll(source, ids, kind).map(({ id, text }) => ({ id, text }));
}

function resolveSection(library: ContentLibrary, section: VariantSection): ResolvedSection {
  switch (section.type) {
    case "header":
      return {
        type: "header",
        mode: section.options.mode,
        showTitle: section.options.showTitle,
        header: library.header,
      };

    case "aboutMe": {
      const about = pick(index(library.aboutMe), section.options.aboutMeId, "aboutMe");
      return { type: "aboutMe", id: about.id, text: about.text };
    }

    case "competencies":
      return {
        type: "competencies",
        items: toBullets(index(library.competencies), section.items, "competency"),
      };

    case "experience": {
      const entries = index(library.experience);
      return {
        type: "experience",
        splitEntries: section.options.splitEntries,
        entries: section.entries.map((ref) => {
          const entry = pick(entries, ref.id, "experience entry");
          return {
            id: entry.id,
            title: entry.title,
            company: entry.company,
            location: entry.location,
            dates: entry.dates,
            bullets: toBullets(index(entry.bullets), ref.bullets, "experience bullet"),
          };
        }),
      };
    }

    case "projects": {
      const entries = index(library.projects);
      return {
        type: "projects",
        splitEntries: section.options.splitEntries,
        entries: section.entries.map((ref) => {
          const entry = pick(entries, ref.id, "project");
          return {
            id: entry.id,
            title: entry.title,
            subtitle: entry.subtitle,
            dates: entry.dates,
            repoUrl: entry.repoUrl,
            demoUrl: entry.demoUrl,
            bullets: toBullets(index(entry.bullets), ref.bullets, "project bullet"),
          };
        }),
      };
    }

    // Entry-level curation only — Education has no bullets to trim (§5.6).
    case "education": {
      const entries = index(library.education);
      return {
        type: "education",
        entries: section.entries.map((ref) => {
          const { id, institution, degree, dates, description } = pick(
            entries,
            ref.id,
            "education entry",
          );
          return { id, institution, degree, dates, description };
        }),
      };
    }

    // Two levels: which groups, and which skills within each (§12.3).
    case "skills": {
      const groups = index(library.skillGroups);
      return {
        type: "skills",
        groups: section.groups.map((ref) => {
          const group = pick(groups, ref.id, "skill group");
          return {
            id: group.id,
            label: group.label,
            skills: toBullets(index(group.skills), ref.skills, "skill"),
          };
        }),
      };
    }

    case "certifications":
      return {
        type: "certifications",
        entries: pickAll(
          index(library.certifications),
          section.entries.map((ref) => ref.id),
          "certification",
        ),
      };

    // Not individually curated — the whole library list renders (§12.3, §15.6).
    case "languages":
      return { type: "languages", entries: library.languages };

    case "recommendations":
      return {
        type: "recommendations",
        mode: section.options.mode,
        entries: pickAll(
          index(library.recommendations),
          section.entries.map((ref) => ref.id),
          "recommendation",
        ),
      };

    case "custom": {
      const item = pick(
        index(library.customSections),
        section.options.customSectionId,
        "custom section",
      );
      return {
        type: "custom",
        section: {
          id: item.id,
          title: item.title,
          paragraph: item.paragraph,
          bullets: item.bullets.map(({ id, text }) => ({ id, text })),
        },
      };
    }
  }
}

/**
 * Whether a resolved section has anything to render beneath its heading.
 *
 * A visible section curated down to nothing is a legitimate state, not an
 * error (§13): the heading and its rule still render, and only the body is
 * dropped — wrapper included, so an empty section cannot leave a stray
 * heading-to-content margin behind. Collapsed Recommendations always has
 * content, because its one line is fixed text rather than a curated entry.
 */
export function sectionHasContent(section: ResolvedSection): boolean {
  switch (section.type) {
    case "header":
      return true;
    case "aboutMe":
      return section.text.trim().length > 0;
    case "competencies":
      return section.items.length > 0;
    case "experience":
    case "projects":
    case "education":
    case "certifications":
    case "languages":
      return section.entries.length > 0;
    case "skills":
      return section.groups.length > 0;
    case "recommendations":
      return section.mode === "collapsed" || section.entries.length > 0;
    case "custom":
      return section.section.paragraph !== null || section.section.bullets.length > 0;
  }
}

/**
 * Flattens a variant against its library. Hidden sections are dropped; a
 * visible section with nothing in it is kept, so §13's "heading renders with an
 * empty body" case reaches the renderer instead of disappearing here.
 */
export function resolveVariant(library: ContentLibrary, variant: Variant): RenderModel {
  return {
    tag: variant.tag,
    label: variant.label,
    sections: variant.sections
      .filter((section) => section.visible)
      .map((section) => resolveSection(library, section)),
  };
}
