"use client";

/**
 * The editor's left column (SPEC §7, §12.5).
 *
 * The variant's own identity — its tag and label — plus the section inventory
 * the curation controls hang off. Every field writes to the draft in the
 * store, which is what the preview and Save both read.
 */
import { SECTION_TITLE } from "@/lib/render/section-titles";
import type { VariantSection } from "@/lib/schema/variant";

import { useEditor } from "./EditorStoreProvider";

const FIELD =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none";

function sectionTitle(section: VariantSection): string {
  if (section.type === "header") return "Header";
  if (section.type === "custom") return "Custom section";
  return SECTION_TITLE[section.type];
}

function SectionRow({ section }: { section: VariantSection }) {
  return (
    <li className="flex items-baseline gap-2 px-3 py-2">
      <span className="text-sm text-gray-900">{sectionTitle(section)}</span>
      <span className="font-mono text-xs text-gray-400">{section.type}</span>
      <span
        className={`ml-auto rounded px-1.5 py-0.5 text-xs ${
          section.visible ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-500"
        }`}
      >
        {section.visible ? "visible" : "hidden"}
      </span>
    </li>
  );
}

export function VariantForm() {
  const tag = useEditor((state) => state.draft.tag);
  const label = useEditor((state) => state.draft.label);
  const sections = useEditor((state) => state.draft.sections);
  const setTag = useEditor((state) => state.setTag);
  const setLabel = useEditor((state) => state.setLabel);

  return (
    <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Variant</h2>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Tag</span>
          <input
            className={FIELD}
            name="tag"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-gray-600">Label</span>
          <input
            className={FIELD}
            name="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">
          Sections <span className="font-normal text-gray-500">({sections.length})</span>
        </h2>
        {sections.length === 0 ? (
          <p className="text-sm text-gray-500">This variant has no sections.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded border border-gray-200">
            {sections.map((section, index) => (
              <SectionRow key={`${section.type}-${index}`} section={section} />
            ))}
          </ul>
        )}
      </section>
    </form>
  );
}
