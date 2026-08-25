/**
 * Variant editor loading state (SPEC §7).
 *
 * The editor is the slowest screen to open — library, variant and the compiled
 * resume stylesheet, all read before anything can render — so it is the one
 * that most needs to show its shape early. Two columns at the same ratio as
 * `EditorShell`, with a page-sized block standing in for the preview, so the
 * layout does not jump when the real thing arrives.
 */
import { Bar, Loading } from "../../../Skeleton";

export default function EditorLoading() {
  return (
    <div className="mx-auto max-w-[1600px] px-6 py-6">
      <Loading label="Opening the variant editor…">
        <header className="mb-4 flex items-baseline gap-3">
          <Bar className="w-64" />
          <Bar className="ml-auto w-24" />
          <Bar className="w-20" />
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
          <div className="space-y-3 rounded-lg border border-gray-200 p-4">
            <Bar className="w-40" />
            <Bar className="w-full" />
            <Bar className="w-5/6" />
            <Bar className="w-2/3" />
            <div className="pt-3" />
            <Bar className="w-44" />
            <Bar className="w-full" />
            <Bar className="w-4/5" />
          </div>
          {/* 4:3-ish, the proportion a Letter page occupies in this column. */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="aspect-[17/22] w-full animate-pulse rounded bg-white shadow-sm" />
          </div>
        </div>
      </Loading>
    </div>
  );
}
