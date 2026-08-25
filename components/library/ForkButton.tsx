"use client";

/**
 * "Fork this bullet" (SPEC §11.4).
 *
 * Forking copies the item under a new ID and repoints *one* variant at the
 * copy, so the rare job-specific wording does not reach every other CV that
 * shares the item. It therefore needs a variant to act on, which the page
 * carries in `?variant=` — arrived at from the editor's "Library" link, so
 * that variant really is the one currently open.
 *
 * With no variant chosen the control is a disabled button with the reason
 * beside it, rather than absent: a missing button reads as "this item cannot
 * be forked", which would be the wrong lesson.
 */
import { useActionState } from "react";

import { IDLE, type ActionState } from "@/app/(dashboard)/action-state";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

const BUTTON =
  "rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

export function ForkButton({
  action,
  itemId,
  noun,
  profileId,
  variantId,
  usedByVariant,
}: {
  action: Action;
  itemId: string;
  /** What the item is, so the button reads "Fork this bullet" (§11.4). */
  noun: string;
  profileId: string;
  variantId: string | null;
  /** Whether the chosen variant references this item — nothing to repoint if not. */
  usedByVariant: boolean;
}) {
  const [state, submit, pending] = useActionState(action, IDLE);
  const blocked = variantId === null ? "choose a variant above" : usedByVariant ? null : "unused";

  return (
    <form action={submit} className="flex items-baseline gap-2">
      <input name="profileId" type="hidden" value={profileId} />
      <input name="itemId" type="hidden" value={itemId} />
      <input name="variantId" type="hidden" value={variantId ?? ""} />
      <button
        aria-busy={pending}
        className={BUTTON}
        disabled={pending || blocked !== null}
        type="submit"
      >
        {pending ? "Forking…" : `Fork this ${noun}`}
      </button>
      {blocked === "choose a variant above" ? (
        <span className="text-xs text-gray-500">choose a variant above to fork into</span>
      ) : null}
      {blocked === "unused" ? (
        <span className="text-xs text-gray-500">not used by {variantId}</span>
      ) : null}
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}
