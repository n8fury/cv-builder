"use client";

/**
 * Compare this variant with another one (SPEC §7, §12.5).
 *
 * Once a profile keeps a family of variants alive at once, the question that
 * comes up is not "what is in this CV" — the form answers that — but "what
 * does the one I am about to send include that the other one did not". This
 * panel answers it: pick another variant of the same profile and the two are
 * listed section by section, entry by entry, with each row marked as being in
 * one, the other, or both.
 *
 * The open side is the *draft*, not the file. Unsaved curation is exactly what
 * someone is most likely to be checking, and comparing the file under an
 * edited editor would answer a question nobody asked. The other side is read
 * off disk, and both are resolved against the draft's library, so a text edit
 * staged in this session cannot masquerade as a curation difference.
 *
 * Nothing here writes: the panel has no button that changes either document.
 * It is a reading of two documents, so it stays out of the store entirely —
 * opening it cannot make the editor dirty and cannot push an undo step.
 */
import { useMemo, useState } from "react";

import {
  compareTargetsAction,
  readVariantAction,
  type CompareTarget,
} from "@/app/(dashboard)/edit/actions";
import { resolveVariant } from "@/lib/data/resolve";
import type { Variant } from "@/lib/schema/variant";

import { DiffReport } from "./DiffReport";
import { diffVariants, onlyDifferences } from "./diff";
import { useEditor } from "./EditorStoreProvider";

const BUTTON =
  "rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const SELECT =
  "rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 focus:border-gray-500 focus:outline-none";

export function VariantDiff() {
  const profileId = useEditor((state) => state.profileId);
  const variantId = useEditor((state) => state.variantId);
  const draft = useEditor((state) => state.draft);

  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<CompareTarget[] | null>(null);
  const [against, setAgainst] = useState<string | null>(null);
  const [other, setOther] = useState<{ variantId: string; variant: Variant } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [everything, setEverything] = useState(false);

  // The list is fetched when the panel is opened rather than with the page:
  // it is a list of files that may have changed since the editor was opened,
  // and most editor sessions never ask for it. Loaded from the button rather
  // than from an effect — opening the panel is the event, and there is no
  // external state here to subscribe to.
  async function reveal(): Promise<void> {
    setOpen(true);
    if (targets !== null) return;
    setBusy(true);
    try {
      setTargets(await compareTargetsAction(profileId, variantId));
      setError(null);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(false);
    }
  }

  async function choose(nextId: string): Promise<void> {
    setAgainst(nextId || null);
    setOther(null);
    setError(null);
    if (!nextId) return;
    setBusy(true);
    try {
      const result = await readVariantAction(profileId, nextId);
      if (result.error || !result.variant) {
        setError(result.error ?? `Could not read ${nextId}.`);
        return;
      }
      setOther({ variantId: nextId, variant: result.variant });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : String(problem));
    } finally {
      setBusy(false);
    }
  }

  // Both sides against the draft's library, so a staged text edit cannot read
  // as curation. A variant whose references the library cannot satisfy is
  // reported in place rather than blanking the panel (§13) — the same rule the
  // preview follows.
  const compared = useMemo(() => {
    if (!other) return null;
    try {
      return {
        diff: diffVariants(
          resolveVariant(draft.library, draft.variant),
          resolveVariant(draft.library, other.variant),
        ),
        error: null as string | null,
      };
    } catch (problem) {
      return { diff: null, error: problem instanceof Error ? problem.message : String(problem) };
    }
  }, [draft, other]);

  const rows = compared?.diff
    ? everything
      ? compared.diff.rows
      : onlyDifferences(compared.diff.rows)
    : [];

  if (!open) {
    return (
      <div className="mb-4">
        <button type="button" data-compare-open className={BUTTON} onClick={() => void reveal()}>
          Compare with another variant…
        </button>
      </div>
    );
  }

  return (
    <section className="mb-4 rounded-lg border border-gray-200 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="font-medium text-gray-900">Compare</span>
        <span className="font-mono">{variantId}</span>
        <span>with</span>
        <select
          data-compare-target
          aria-label="Variant to compare with"
          className={SELECT}
          disabled={targets === null || targets.length === 0}
          value={against ?? ""}
          onChange={(event) => void choose(event.target.value)}
        >
          <option value="">
            {targets === null ? "Loading…" : targets.length === 0 ? "No other variants" : "Choose…"}
          </option>
          {(targets ?? []).map((target) => (
            <option key={target.variantId} value={target.variantId}>
              {target.variantId}
              {target.label ? ` — ${target.label}` : ""}
            </option>
          ))}
        </select>

        {compared?.diff ? (
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              data-compare-everything
              checked={everything}
              onChange={(event) => setEverything(event.target.checked)}
            />
            Show what they share
          </label>
        ) : null}

        <button
          type="button"
          data-compare-close
          className={`${BUTTON} ml-auto`}
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {compared?.error ? (
        <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          Comparison unavailable — {compared.error}
        </p>
      ) : null}

      {busy ? <p className="text-xs text-gray-500">Reading…</p> : null}

      {compared?.diff ? (
        <DiffReport diff={compared.diff} other={other!.variantId} rows={rows} />
      ) : null}

      {!busy && !error && !compared ? (
        <p className="text-xs text-gray-500">
          Pick a variant to see what each one includes that the other does not.
        </p>
      ) : null}
    </section>
  );
}
