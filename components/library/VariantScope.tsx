/**
 * Which variant the manager's per-variant actions apply to (SPEC §11.4).
 *
 * The library manager is deliberately not scoped to one CV — §7 makes it a
 * separate screen from the variant editor. Fork, though, has to name a single
 * variant to repoint, so the choice is explicit and lives in the URL. The
 * editor links here with its own variant already selected, which is what makes
 * §11.4's "the currently open variant" literal rather than implied.
 *
 * A plain GET form: the selection is a navigation, so it belongs in the
 * address bar where it can be linked to and reloaded.
 */
export function VariantScope({
  variants,
  selected,
}: {
  variants: string[];
  selected: string | null;
}) {
  if (variants.length === 0) {
    return (
      <p className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-500">
        This profile has no variants yet, so there is nothing to fork into.
      </p>
    );
  }

  return (
    <form className="flex flex-wrap items-baseline gap-2 rounded border border-gray-200 px-3 py-2">
      <label className="text-sm text-gray-600" htmlFor="variant-scope">
        Fork into variant
      </label>
      <select
        className="rounded border border-gray-300 px-2 py-1 font-mono text-sm"
        defaultValue={selected ?? ""}
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
        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        type="submit"
      >
        Apply
      </button>
      <span className="text-xs text-gray-500">
        Editing text below reaches every variant (§11.4); forking affects only this one.
      </span>
    </form>
  );
}
