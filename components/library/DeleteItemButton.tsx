"use client";

/**
 * Delete one library item (SPEC §7, §12.7).
 *
 * The counterpart to propagate-on-edit: without it the library only ever
 * grows, and §7 names that as the reason the manager exists. A referenced item
 * is refused server-side with the referencing variants named — nothing here
 * decides that, so a stale page cannot talk its way past the check.
 */
import { useActionState } from "react";

import { IDLE, type ActionState } from "@/app/(dashboard)/action-state";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

export function DeleteItemButton({
  action,
  itemId,
  profileId,
  usedBy,
}: {
  action: Action;
  itemId: string;
  profileId: string;
  /** Variants referencing the item — shown in the confirmation and the block. */
  usedBy: string[];
}) {
  const [state, submit, pending] = useActionState(action, IDLE);
  const orphaned = usedBy.length === 0;

  return (
    <form action={submit} className="flex items-baseline gap-2">
      <input name="profileId" type="hidden" value={profileId} />
      <input name="itemId" type="hidden" value={itemId} />
      <button
        aria-busy={pending}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        disabled={pending}
        onClick={(event) => {
          // Irreversible, and there is no trash (§15.12). The confirmation is
          // all that stands between a misclick and lost writing.
          const message = orphaned
            ? `Delete "${itemId}" from the library? No variant uses it. This cannot be undone.`
            : `"${itemId}" is used by ${usedBy.join(", ")}. Deleting is blocked — continue to see why?`;
          if (!window.confirm(message)) event.preventDefault();
        }}
        type="submit"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}
