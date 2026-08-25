/**
 * Library manager loading state (SPEC §7, §12.7).
 *
 * The manager reads the library *and* every variant on disk, because "used by
 * no variant" is a claim about all of them — the slowest read on the screen and
 * the reason this fallback exists. Shaped like `page.tsx`: scope row, tag
 * filter, then the grouped item list.
 */
import { Bar, Loading } from "../../Skeleton";

function ItemRow() {
  return (
    <li className="flex items-baseline gap-3 px-4 py-3">
      <Bar className="w-1/2" />
      <Bar className="ml-auto w-16" />
      <Bar className="w-20" />
    </li>
  );
}

function Group({ rows }: { rows: number }) {
  return (
    <section className="rounded-lg border border-gray-200">
      <header className="flex items-baseline gap-3 border-b border-gray-200 px-4 py-3">
        <Bar className="w-40" />
        <Bar className="ml-auto w-12" />
      </header>
      <ul className="divide-y divide-gray-100">
        {Array.from({ length: rows }, (_, index) => (
          <ItemRow key={index} />
        ))}
      </ul>
    </section>
  );
}

export default function LibraryLoading() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <Loading label="Loading the content library…">
        <Bar className="w-24" />
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">Content library</h1>
        <div className="mt-2 space-y-2">
          <Bar className="w-96" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="rounded border border-gray-200 px-3 py-3">
            <Bar className="w-72" />
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <Bar className="w-24" />
            <Bar className="w-12" />
            <Bar className="w-16" />
            <Bar className="w-14" />
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <Group rows={3} />
          <Group rows={2} />
        </div>
      </Loading>
    </main>
  );
}
