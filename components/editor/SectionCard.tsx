"use client";

/**
 * One section in the editor's left column (SPEC §7, §11.4).
 *
 * The row names the section, toggles whether it renders at all, and carries
 * whatever `options` that section type has (§12.2). Beneath it, sections with
 * bullets expose each curated bullet as a text field. A bullet's text belongs
 * to the library, not the variant (§6.2), so those fields edit the library
 * draft — exactly the propagating edit §11.4 describes, staged until Save.
 */
import { SECTION_TITLE } from "@/lib/render/section-titles";
import type { ContentLibrary } from "@/lib/schema/library";
import type { VariantSection } from "@/lib/schema/variant";

import { EntryCuration } from "./EntryCuration";
import { useEditor } from "./EditorStoreProvider";

const SELECT = "rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-900";

function sectionTitle(section: VariantSection, library: ContentLibrary): string {
  if (section.type === "header") return "Header";
  if (section.type === "custom") {
    const found = library.customSections.find((item) => item.id === section.options.customSectionId);
    return found?.title ?? "Custom section";
  }
  return SECTION_TITLE[section.type];
}

/** A reference the library cannot satisfy is named, not hidden (§13). */
function MissingRef({ id }: { id: string }) {
  return (
    <p className="text-xs text-red-700">
      <span className="font-mono">{id}</span> — not in the library
    </p>
  );
}

/**
 * Included items first, in the variant's order (§15.3), then everything else
 * the library offers. The form's order is the CV's order, so the two columns
 * read the same way down the page.
 */
function ordered<T extends { id: string }>(all: readonly T[], includedIds: readonly string[]): T[] {
  const byId = new Map(all.map((item) => [item.id, item]));
  const included = includedIds.flatMap((id) => {
    const found = byId.get(id);
    return found ? [found] : [];
  });
  return [...included, ...all.filter((item) => !includedIds.includes(item.id))];
}

function SectionBody({
  section,
  index,
  library,
}: {
  section: VariantSection;
  index: number;
  library: ContentLibrary;
}) {
  const setBulletText = useEditor((state) => state.setBulletText);

  switch (section.type) {
    case "competencies":
      return (
        <EntryCuration
          sectionIndex={index}
          entries={ordered(library.competencies, section.items).map((item) => ({
            id: item.id,
            heading: item.text,
            subheading: "",
            included: section.items.includes(item.id),
          }))}
        />
      );

    // One branch per collection: a union of two entry shapes would lose the
    // fields that tell them apart.
    case "experience": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          sectionIndex={index}
          entries={ordered(library.experience, includedIds).map((entry) => ({
            id: entry.id,
            heading: entry.title,
            subheading: entry.company,
            included: includedIds.includes(entry.id),
            bullets: {
              all: entry.bullets,
              includedIds: section.entries.find((ref) => ref.id === entry.id)?.bullets ?? [],
              owner: "experience" as const,
            },
          }))}
        />
      );
    }

    case "projects": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          sectionIndex={index}
          entries={ordered(library.projects, includedIds).map((entry) => ({
            id: entry.id,
            heading: entry.title,
            subheading: entry.subtitle,
            included: includedIds.includes(entry.id),
            bullets: {
              all: entry.bullets,
              includedIds: section.entries.find((ref) => ref.id === entry.id)?.bullets ?? [],
              owner: "projects" as const,
            },
          }))}
        />
      );
    }

    // Entry-level only: no bullet data is passed, so no bullet toggles exist
    // to render (§15.7).
    case "education": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          sectionIndex={index}
          entries={ordered(library.education, includedIds).map((entry) => ({
            id: entry.id,
            heading: entry.institution,
            subheading: entry.degree,
            included: includedIds.includes(entry.id),
          }))}
        />
      );
    }

    case "certifications": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          sectionIndex={index}
          entries={ordered(library.certifications, includedIds).map((entry) => ({
            id: entry.id,
            heading: entry.text,
            subheading: entry.dates,
            included: includedIds.includes(entry.id),
          }))}
        />
      );
    }

    case "recommendations": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          sectionIndex={index}
          entries={ordered(library.recommendations, includedIds).map((entry) => ({
            id: entry.id,
            heading: entry.name,
            subheading: [entry.role, entry.location].filter(Boolean).join(" — "),
            included: includedIds.includes(entry.id),
          }))}
        />
      );
    }

    // Not individually curated — whole-section `visible` only (§12.3, §15.6).
    case "languages":
      return (
        <p className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">
          Every language renders; this section is all-or-nothing.
        </p>
      );

    case "custom": {
      const entry = library.customSections.find(
        (item) => item.id === section.options.customSectionId,
      );
      if (!entry) {
        return (
          <div className="border-t border-gray-100 px-3 py-2">
            <MissingRef id={section.options.customSectionId} />
          </div>
        );
      }
      return (
        <div className="space-y-1 border-t border-gray-100 px-3 py-2">
          {/* A custom section's bullets are not curated per variant — the
              library item is the unit (§12.4) — so they get fields, not
              toggles. */}
          {entry.bullets.map((bullet) => (
            <textarea
              key={bullet.id}
              className="w-full resize-y rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
              data-bullet={bullet.id}
              rows={2}
              value={bullet.text}
              onChange={(event) =>
                setBulletText("customSections", entry.id, bullet.id, event.target.value)
              }
            />
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}

/** The `options` a section type has, if any (§12.2). */
function SectionOptions({
  section,
  index,
  library,
}: {
  section: VariantSection;
  index: number;
  library: ContentLibrary;
}) {
  const setHeaderMode = useEditor((state) => state.setHeaderMode);
  const setAboutMeId = useEditor((state) => state.setAboutMeId);
  const setRecommendationsMode = useEditor((state) => state.setRecommendationsMode);
  const setCustomSectionId = useEditor((state) => state.setCustomSectionId);

  if (section.type === "header") {
    return (
      <label className="flex items-center gap-2 px-3 pb-2 text-xs text-gray-600">
        Mode
        <select
          className={SELECT}
          name={`header-mode-${index}`}
          value={section.options.mode}
          onChange={(event) => setHeaderMode(index, event.target.value === "minimal" ? "minimal" : "full")}
        >
          <option value="full">full</option>
          <option value="minimal">minimal</option>
        </select>
      </label>
    );
  }

  if (section.type === "aboutMe") {
    return (
      <label className="flex items-center gap-2 px-3 pb-2 text-xs text-gray-600">
        Version
        <select
          className={SELECT}
          name={`about-me-${index}`}
          value={section.options.aboutMeId}
          onChange={(event) => setAboutMeId(index, event.target.value)}
        >
          {library.aboutMe.map((item) => (
            <option key={item.id} value={item.id}>
              {item.key || item.id}
            </option>
          ))}
          {library.aboutMe.some((item) => item.id === section.options.aboutMeId) ? null : (
            <option value={section.options.aboutMeId}>{section.options.aboutMeId} (missing)</option>
          )}
        </select>
      </label>
    );
  }

  if (section.type === "recommendations") {
    return (
      <label className="flex items-center gap-2 px-3 pb-2 text-xs text-gray-600">
        Mode
        <select
          className={SELECT}
          name={`recommendations-mode-${index}`}
          value={section.options.mode}
          onChange={(event) =>
            setRecommendationsMode(index, event.target.value === "expanded" ? "expanded" : "collapsed")
          }
        >
          <option value="collapsed">collapsed</option>
          <option value="expanded">expanded</option>
        </select>
      </label>
    );
  }

  if (section.type === "custom") {
    return (
      <label className="flex items-center gap-2 px-3 pb-2 text-xs text-gray-600">
        Content
        <select
          className={SELECT}
          name={`custom-section-${index}`}
          value={section.options.customSectionId}
          onChange={(event) => setCustomSectionId(index, event.target.value)}
        >
          {library.customSections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title || item.id}
            </option>
          ))}
          {library.customSections.some((item) => item.id === section.options.customSectionId) ? null : (
            <option value={section.options.customSectionId}>
              {section.options.customSectionId} (missing)
            </option>
          )}
        </select>
      </label>
    );
  }

  return null;
}

export function SectionCard({
  section,
  index,
  library,
}: {
  section: VariantSection;
  index: number;
  library: ContentLibrary;
}) {
  const setSectionVisible = useEditor((state) => state.setSectionVisible);

  return (
    <li data-section={section.type} data-index={index} className={section.visible ? undefined : "bg-gray-50"}>
      <div className="flex items-baseline gap-2 px-3 py-2">
        <span className={`text-sm ${section.visible ? "text-gray-900" : "text-gray-400"}`}>
          {sectionTitle(section, library)}
        </span>
        <span className="font-mono text-xs text-gray-400">{section.type}</span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            name={`visible-${index}`}
            checked={section.visible}
            onChange={(event) => setSectionVisible(index, event.target.checked)}
          />
          Visible
        </label>
      </div>
      <SectionOptions section={section} index={index} library={library} />
      {/* Shown for hidden sections too: curation is often prepared before a
          section is switched back on, and collapsing it would shuffle the
          whole column on every toggle. */}
      <SectionBody section={section} index={index} library={library} />
    </li>
  );
}
