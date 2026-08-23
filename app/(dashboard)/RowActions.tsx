"use client";

/**
 * Rename and Delete controls shared by variant and profile rows (§15.12).
 *
 * Both are plain forms bound to a server action, so they work as ordinary
 * submissions and the store stays the only thing that mutates the disk. The
 * action is passed in rather than imported here, which keeps one pair of
 * controls for both row types.
 */
import { useActionState, useState } from "react";

import { IDLE, type ActionState } from "./action-state";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

interface Common {
  action: Action;
  /** Hidden ids identifying the row the action applies to. */
  fields: Record<string, string>;
}

const BUTTON =
  "rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

function HiddenFields({ fields }: { fields: Record<string, string> }) {
  return (
    <>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
    </>
  );
}

export function RenameForm({
  action,
  fields,
  currentId,
  label,
}: Common & { currentId: string; label: string }) {
  const [state, submit, pending] = useActionState(action, IDLE);
  const [open, setOpen] = useState(false);

  // A successful rename changes the row's key, so this component unmounts and
  // the form closes on its own; only a failure keeps it open, with its reason.
  if (!open) {
    return (
      <button className={BUTTON} onClick={() => setOpen(true)} type="button">
        Rename
      </button>
    );
  }

  return (
    <form action={submit} className="flex items-baseline gap-2">
      <HiddenFields fields={fields} />
      <label className="sr-only" htmlFor={`rename-${currentId}`}>
        {label}
      </label>
      <input
        autoFocus
        className="w-48 rounded border border-gray-300 px-2 py-1 font-mono text-xs"
        defaultValue={currentId}
        disabled={pending}
        id={`rename-${currentId}`}
        name="nextId"
        required
      />
      <button className={BUTTON} disabled={pending} type="submit">
        {pending ? "Saving…" : "Save"}
      </button>
      <button className={BUTTON} onClick={() => setOpen(false)} type="button">
        Cancel
      </button>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}

export function DeleteButton({
  action,
  fields,
  confirmMessage,
}: Common & { confirmMessage: string }) {
  const [state, submit, pending] = useActionState(action, IDLE);

  return (
    <form action={submit} className="flex items-baseline gap-2">
      <HiddenFields fields={fields} />
      {/* Deletion is irreversible — there is no trash (§15.12), so the
          confirmation is the only thing standing between a misclick and lost
          curation work. */}
      <button
        className={`${BUTTON} text-red-700 hover:bg-red-50`}
        disabled={pending}
        onClick={(event) => {
          if (!window.confirm(confirmMessage)) event.preventDefault();
        }}
        type="submit"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
    </form>
  );
}
