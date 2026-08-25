"use client";

/**
 * The edit form for the profile's header (SPEC §5.1, §7, §16.6).
 *
 * A form of its own rather than another `ItemForm`: every row in the library
 * browser is an ID-bearing item that can be tagged, forked and deleted, and
 * the header is one record with none of those operations. Sharing the
 * component would mean disabling three of its four controls.
 *
 * The links list is edited client-side and posted as parallel `link.id` /
 * `link.text` / `link.url` fields, so adding and removing rows costs no round
 * trip — the save is still one write, and clearing a row's text is what
 * deletes it.
 *
 * A row is two boxes: what prints, and where it points (§18.1). The URL is
 * optional — a row with only text prints exactly as it did before it had the
 * second box.
 */
import { useActionState, useState } from "react";

import { IDLE, type ActionState } from "@/app/(dashboard)/action-state";
import type { HeaderLink } from "@/lib/schema/library";

type Action = (state: ActionState, form: FormData) => Promise<ActionState>;

const INPUT = "w-full rounded border border-gray-300 px-2 py-1 text-sm";

/** A links row in the form, before it has been saved and given a real ID. */
interface DraftLink {
  id: string;
  text: string;
  /** Empty rather than null: this is an input's value, not stored data. */
  url: string;
  /** Distinguishes rows in React's key space while `id` is still blank. */
  key: string;
}

export function HeaderForm({
  action,
  fields,
  links,
  profileId,
}: {
  action: Action;
  fields: { name: string; label: string; value: string }[];
  links: HeaderLink[];
  profileId: string;
}) {
  const [state, submit, pending] = useActionState(action, IDLE);
  const [rows, setRows] = useState<DraftLink[]>(() =>
    links.map((link) => ({ id: link.id, text: link.text, url: link.url ?? "", key: link.id })),
  );

  const addRow = () =>
    setRows((current) => [...current, { id: "", text: "", url: "", key: `new-${Date.now()}` }]);

  const setRowField = (key: string, field: "text" | "url", value: string) =>
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );

  const removeRow = (key: string) =>
    setRows((current) => current.filter((row) => row.key !== key));

  return (
    <section className="rounded-lg border border-gray-200">
      <header className="flex items-baseline gap-3 border-b border-gray-200 px-4 py-2">
        <h2 className="font-semibold text-gray-900">Header</h2>
        <span className="ml-auto text-xs text-gray-500">
          one per profile — every variant renders it
        </span>
      </header>

      <form action={submit} className="space-y-3 px-4 py-3">
        <input name="profileId" type="hidden" value={profileId} />

        <div className="grid grid-cols-2 gap-3">
          {fields.map((field) => {
            const id = `header-${field.name}`;
            return (
              <div key={field.name}>
                <label className="block text-xs font-medium text-gray-600" htmlFor={id}>
                  {field.label}
                </label>
                <input
                  className={INPUT}
                  defaultValue={field.value}
                  disabled={pending}
                  id={id}
                  name={`field.${field.name}`}
                />
              </div>
            );
          })}
        </div>

        {/* Extra links sit on the same printed line as LinkedIn and GitHub, in
            this order (§16.6) — hence a list rather than more named boxes. */}
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-baseline gap-3">
            <span className="text-xs font-medium text-gray-600">Other links</span>
            <span className="text-xs text-gray-500">
              printed after GitHub, in this order — the URL is optional
            </span>
            <button
              className="ml-auto rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={pending}
              onClick={addRow}
              type="button"
            >
              Add link
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="text-xs text-gray-500">
              None. Add one for a portfolio, X, Dev.to — anything past LinkedIn and GitHub.
            </p>
          ) : (
            rows.map((row) => (
              <div className="flex items-center gap-2" key={row.key}>
                <input name="link.id" type="hidden" value={row.id} />
                <input
                  aria-label="Link text"
                  className={INPUT}
                  disabled={pending}
                  name="link.text"
                  onChange={(event) => setRowField(row.key, "text", event.target.value)}
                  placeholder="portfolio.example.com"
                  value={row.text}
                />
                <input
                  aria-label="Link URL"
                  className={INPUT}
                  disabled={pending}
                  name="link.url"
                  onChange={(event) => setRowField(row.key, "url", event.target.value)}
                  placeholder="https://portfolio.example.com"
                  value={row.url}
                />
                <button
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  disabled={pending}
                  onClick={() => removeRow(row.key)}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))
          )}
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
          <span className="text-xs text-gray-500">
            The title only prints on variants with &ldquo;Show title&rdquo; switched on.
          </span>
          {state.error ? <span className="text-xs text-red-700">{state.error}</span> : null}
        </div>
      </form>
    </section>
  );
}
