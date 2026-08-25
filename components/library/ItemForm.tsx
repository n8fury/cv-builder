"use client";

/**
 * The edit form for one library item (SPEC §7, §11.4).
 *
 * One component for all twelve kinds: the fields come from the item, which got
 * them from `ITEM_FIELDS`, so a kind never needs a form of its own. Saving
 * rewrites the library, and every variant referencing this ID renders the new
 * text — the propagation of §11.4 is the library write, nothing more.
 */
import { useActionState } from "react";

import { IDLE, type ActionState } from "@/app/(dashboard)/action-state";
import type { LibraryItem } from "@/lib/data/library-index";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

const INPUT = "w-full rounded border border-gray-300 px-2 py-1 text-sm";

export function ItemForm({
  action,
  item,
  profileId,
}: {
  action: Action;
  item: LibraryItem;
  profileId: string;
}) {
  const [state, submit, pending] = useActionState(action, IDLE);

  return (
    <form action={submit} className="mt-2 space-y-2 rounded bg-gray-50 p-3">
      <input name="profileId" type="hidden" value={profileId} />
      <input name="itemId" type="hidden" value={item.id} />
      <input name="kind" type="hidden" value={item.kind} />

      {item.fields.map((field) => {
        const id = `field-${item.id}-${field.name}`;
        return (
          <div key={field.name}>
            <label className="block text-xs font-medium text-gray-600" htmlFor={id}>
              {field.label}
            </label>
            {field.multiline ? (
              <textarea
                className={INPUT}
                defaultValue={field.value}
                disabled={pending}
                id={id}
                name={`field.${field.name}`}
                rows={3}
              />
            ) : (
              <input
                className={INPUT}
                defaultValue={field.value}
                disabled={pending}
                id={id}
                name={`field.${field.name}`}
                // A link field is nullable and the schema rejects a non-URL
                // string, so the browser blocks a typo before the write does.
                type={field.url ? "url" : "text"}
              />
            )}
          </div>
        );
      })}

      {/* Tags are universal rather than per-kind (§6.1), so they sit below the
          fields and post as one comma-separated string, normalised server-side. */}
      <div>
        <label className="block text-xs font-medium text-gray-600" htmlFor={`tags-${item.id}`}>
          Tags (comma separated)
        </label>
        <input
          className={INPUT}
          defaultValue={item.tags.join(", ")}
          disabled={pending}
          id={`tags-${item.id}`}
          name="tags"
          placeholder="backend, iot, ml"
        />
      </div>

      <div className="flex items-baseline gap-3">
        <button
          aria-busy={pending}
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
      </div>
    </form>
  );
}
