"use client";

/**
 * New Profile form (SPEC §9, §12.7).
 *
 * Name plus id slug; the action scaffolds the directory, the empty content
 * library and the `variants/` directory. The id is suggested from the name as
 * it is typed but stays editable — it becomes the URL and the folder name, so
 * it is worth being able to shorten by hand.
 */
import { useActionState, useState } from "react";

import { IDLE } from "./action-state";
import { createProfileAction } from "./actions";

/** Same shape the store enforces: letters, digits, dashes, underscores. */
function suggestId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const INPUT = "w-full rounded border border-gray-300 px-2 py-1 text-sm";

export function NewProfileForm() {
  const [state, submit, pending] = useActionState(createProfileAction, IDLE);
  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState("");
  const [touched, setTouched] = useState(false);

  return (
    <form action={submit} className="rounded-lg border border-gray-200 p-4">
      <h2 className="font-semibold text-gray-900">New profile</h2>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex-1 text-xs text-gray-600">
          Name
          <input
            className={INPUT}
            disabled={pending}
            name="name"
            onChange={(event) => {
              setName(event.target.value);
              if (!touched) setProfileId(suggestId(event.target.value));
            }}
            placeholder="Jordan A. Rivera"
            required
            value={name}
          />
        </label>

        <label className="flex-1 text-xs text-gray-600">
          Profile id
          <input
            className={`${INPUT} font-mono`}
            disabled={pending}
            name="profileId"
            onChange={(event) => {
              setTouched(true);
              setProfileId(event.target.value);
            }}
            placeholder="jordan-rivera"
            required
            value={profileId}
          />
        </label>

        <button
          className="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Creating…" : "Create profile"}
        </button>
      </div>

      {state.error ? <p className="mt-2 text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
