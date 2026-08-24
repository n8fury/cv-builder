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
import type { Bullet, ContentLibrary } from "@/lib/schema/library";
import type { VariantSection } from "@/lib/schema/variant";

import { useEditor } from "./EditorStoreProvider";
import type { BulletOwner } from "./store";

const FIELD =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none";
const SELECT = "rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-900";

function sectionTitle(section: VariantSection, library: ContentLibrary): string {
  if (section.type === "header") return "Header";
  if (section.type === "custom") {
    const found = library.customSections.find((item) => item.id === section.options.customSectionId);
    return found?.title ?? "Custom section";
  }
  return SECTION_TITLE[section.type];
}

function BulletField({
  owner,
  entryId,
  bullet,
}: {
  owner: BulletOwner;
  entryId: string;
  bullet: Bullet;
}) {
  const setBulletText = useEditor((state) => state.setBulletText);
  return (
    <label className="block">
      <span className="sr-only">Bullet {bullet.id}</span>
      <textarea
        className={`${FIELD} resize-y`}
        data-bullet={bullet.id}
        rows={2}
        value={bullet.text}
        onChange={(event) => setBulletText(owner, entryId, bullet.id, event.target.value)}
      />
    </label>
  );
}

/** A reference the library cannot satisfy is named, not hidden (§13). */
function MissingRef({ id }: { id: string }) {
  return (
    <p className="text-xs text-red-700">
      <span className="font-mono">{id}</span> — not in the library
    </p>
  );
}

function EntryEditor({
  owner,
  entryId,
  heading,
  subheading,
  bullets,
}: {
  owner: BulletOwner;
  entryId: string;
  heading: string;
  subheading: string;
  bullets: Bullet[];
}) {
  return (
    <div className="space-y-1 px-3 py-2">
      <p className="text-sm font-medium text-gray-900">{heading}</p>
      <p className="text-xs text-gray-500">{subheading}</p>
      <div className="space-y-1 pt-1">
        {bullets.map((bullet) => (
          <BulletField key={bullet.id} owner={owner} entryId={entryId} bullet={bullet} />
        ))}
      </div>
    </div>
  );
}

/**
 * Bullets are curated per entry, so the variant's ID list decides which ones
 * appear here — the form shows the same subset the preview renders.
 */
function curatedBullets(all: Bullet[], ids: readonly string[]): Bullet[] {
  return ids.flatMap((id) => all.filter((bullet) => bullet.id === id));
}

function SectionBody({
  section,
  library,
}: {
  section: VariantSection;
  library: ContentLibrary;
}) {
  if (section.type === "experience" || section.type === "projects") {
    const entries = section.type === "experience" ? library.experience : library.projects;
    return (
      <div className="divide-y divide-gray-100 border-t border-gray-100">
        {section.entries.map((ref) => {
          const entry = entries.find((item) => item.id === ref.id);
          if (!entry) {
            return (
              <div key={ref.id} className="px-3 py-2">
                <MissingRef id={ref.id} />
              </div>
            );
          }
          return (
            <EntryEditor
              key={entry.id}
              owner={section.type}
              entryId={entry.id}
              heading={entry.title}
              subheading={"company" in entry ? entry.company : entry.subtitle}
              bullets={curatedBullets(entry.bullets, ref.bullets)}
            />
          );
        })}
      </div>
    );
  }

  if (section.type === "custom") {
    const entry = library.customSections.find((item) => item.id === section.options.customSectionId);
    if (!entry) {
      return (
        <div className="border-t border-gray-100 px-3 py-2">
          <MissingRef id={section.options.customSectionId} />
        </div>
      );
    }
    return (
      <div className="border-t border-gray-100">
        <EntryEditor
          owner="customSections"
          entryId={entry.id}
          heading={entry.title}
          subheading={entry.paragraph ?? ""}
          bullets={entry.bullets}
        />
      </div>
    );
  }

  return null;
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
    <li className={section.visible ? undefined : "bg-gray-50"}>
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
      <SectionBody section={section} library={library} />
    </li>
  );
}
