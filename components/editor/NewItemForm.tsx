"use client";

/**
 * The new-content control (SPEC §6.3, §7).
 *
 * §6.3 admits no "one-off, not saved to the library" path, so this is not a
 * second kind of editing — it is the only way new text enters the editor, and
 * what it produces is a library item with a generated ID that the open variant
 * then references. The form itself is deliberately thin: which fields exist
 * per section is declared once in `lib/data/new-items.ts`, beside the builder
 * that consumes them.
 *
 * It stays collapsed until asked for. An always-open form under every section
 * and every entry would double the length of a column whose job is curation,
 * and an empty item created by a stray click is exactly the library cruft §7's
 * manager exists to clean up — so nothing is written until Add is pressed with
 * the required fields filled.
 */
import { useId, useState } from "react";

import { isComplete, type NewItemSpec, type NewItemValues } from "@/lib/data/new-items";

const FIELD =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none";
const BUTTON = "rounded px-2 py-1 text-xs font-medium";

export function NewItemForm({
  spec,
  onAdd,
  className = "",
}: {
  spec: NewItemSpec;
  onAdd: (values: NewItemValues) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<NewItemValues>({});
  const formId = useId();

  function close() {
    setOpen(false);
    setValues({});
  }

  if (!open) {
    return (
      <div className={className}>
        <button
          type="button"
          data-add={spec.noun}
          className={`${BUTTON} text-gray-500 hover:bg-gray-100 hover:text-gray-800`}
          onClick={() => setOpen(true)}
        >
          + Add {spec.noun}
        </button>
      </div>
    );
  }

  const complete = isComplete(spec, values);

  return (
    // Not a <form>: the editor's left column is itself a <form>, and nesting
    // one inside another is invalid HTML that browsers silently drop.
    <div className={`space-y-1 rounded border border-gray-300 bg-white p-2 ${className}`}>
      {spec.fields.map((field) => {
        const id = `${formId}-${field.name}`;
        const value = values[field.name] ?? "";
        const onChange = (next: string) =>
          setValues((current) => ({ ...current, [field.name]: next }));
        return (
          <label key={field.name} className="block space-y-0.5">
            <span className="text-xs font-medium text-gray-600">
              {field.label}
              {field.optional ? <span className="text-gray-400"> (optional)</span> : null}
            </span>
            {field.multiline ? (
              <textarea
                id={id}
                data-new-field={field.name}
                className={`${FIELD} resize-y`}
                rows={2}
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
            ) : (
              <input
                id={id}
                data-new-field={field.name}
                className={FIELD}
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
            )}
          </label>
        );
      })}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          data-add-submit={spec.noun}
          disabled={!complete}
          className={`${BUTTON} bg-gray-900 text-white disabled:bg-gray-300`}
          onClick={() => {
            if (!complete) return;
            onAdd(values);
            close();
          }}
        >
          Add
        </button>
        <button
          type="button"
          className={`${BUTTON} text-gray-500 hover:bg-gray-100 hover:text-gray-800`}
          onClick={close}
        >
          Cancel
        </button>
        <span className="text-xs text-gray-400">Saved to the library</span>
      </div>
    </div>
  );
}
