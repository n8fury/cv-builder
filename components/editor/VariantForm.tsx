"use client";

/**
 * The editor's left column (SPEC §7, §12.5).
 *
 * The variant's own identity — its tag and label — above the section list the
 * curation controls hang off. Every field writes to the draft in the store,
 * which is what the preview and Save both read; nothing here calls the server.
 */
import { useEditor } from "./EditorStoreProvider";
import { SectionCard } from "./SectionCard";

const FIELD =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none";

export function VariantForm() {
  const tag = useEditor((state) => state.draft.variant.tag);
  const label = useEditor((state) => state.draft.variant.label);
  const sections = useEditor((state) => state.draft.variant.sections);
  const library = useEditor((state) => state.draft.library);
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
              <SectionCard
                key={`${section.type}-${index}`}
                section={section}
                index={index}
                library={library}
              />
            ))}
          </ul>
        )}
      </section>
    </form>
  );
}
