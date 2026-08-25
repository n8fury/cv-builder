"use client";

/**
 * Which variant the manager's per-variant actions apply to (SPEC §11.4).
 *
 * The library manager is deliberately not scoped to one CV — §7 makes it a
 * separate screen from the variant editor. Fork, though, has to name a single
 * variant to repoint, so the choice is explicit and lives in the URL. The
 * editor links here with its own variant already selected, which is what makes
 * §11.4's "the currently open variant" literal rather than implied.
 *
 * Still a GET form, so the selection stays a navigation that can be linked to
 * and reloaded — but pushed through a transition rather than left to the
 * browser. Applying re-reads the library and every variant on disk, and until
 * that lands the page shows the *old* scope: without a pending state Apply
 * looks like it did nothing, which invites the second click this disables.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type FormEvent } from "react";

export function VariantScope({
  variants,
  selected,
}: {
  variants: string[];
  selected: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (variants.length === 0) {
    return (
      <p className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-500">
        This profile has no variants yet, so there is nothing to fork into.
      </p>
    );
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const chosen = new FormData(event.currentTarget).get("variant");
    // Keep every other search param — dropping `?tag=` here would silently
    // undo the filter the person is looking at.
    const next = new URLSearchParams(params.toString());
    if (typeof chosen === "string" && chosen.length > 0) next.set("variant", chosen);
    else next.delete("variant");
    const query = next.toString();
    // `startTransition` holds `pending` until the new page has rendered, which
    // is the whole point: the disk reads happen on the server.
    startTransition(() => router.push(query ? `?${query}` : "?"));
  }

  return (
    <form
      className="flex flex-wrap items-baseline gap-2 rounded border border-gray-200 px-3 py-2"
      onSubmit={apply}
    >
      <label className="text-sm text-gray-600" htmlFor="variant-scope">
        Fork into variant
      </label>
      <select
        className="rounded border border-gray-300 px-2 py-1 font-mono text-sm disabled:opacity-50"
        defaultValue={selected ?? ""}
        disabled={pending}
        id="variant-scope"
        name="variant"
      >
        <option value="">— none —</option>
        {variants.map((variantId) => (
          <option key={variantId} value={variantId}>
            {variantId}
          </option>
        ))}
      </select>
      <button
        aria-busy={pending}
        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        data-apply-scope
        disabled={pending}
        type="submit"
      >
        {pending ? "Applying…" : "Apply"}
      </button>
      <span className="text-xs text-gray-500">
        Editing text below reaches every variant (§11.4); forking affects only this one.
      </span>
    </form>
  );
}
