/**
 * Dashboard loading state (SPEC §7).
 *
 * Shaped like `page.tsx`: the New Profile panel, then two profile cards with
 * their variant rows. It also serves as the fallback for any segment in this
 * group that has no `loading.tsx` of its own.
 */
import { Bar, Loading } from "./Skeleton";

function VariantRow() {
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex items-baseline gap-3">
        <Bar className="w-48" />
        <Bar className="w-16" />
        <Bar className="ml-auto w-28" />
      </div>
      <div className="flex items-baseline gap-3">
        <Bar className="w-40" />
        <Bar className="ml-auto w-12" />
        <Bar className="w-12" />
        <Bar className="w-24" />
      </div>
    </li>
  );
}

function ProfileCard({ rows }: { rows: number }) {
  return (
    <section className="rounded-lg border border-gray-200">
      <header className="flex items-baseline gap-3 border-b border-gray-200 px-4 py-3">
        <Bar className="w-44" />
        <Bar className="w-28" />
        <Bar className="ml-auto w-20" />
      </header>
      <ul className="divide-y divide-gray-100">
        {Array.from({ length: rows }, (_, index) => (
          <VariantRow key={index} />
        ))}
      </ul>
    </section>
  );
}

export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold text-gray-900">CV Builder</h1>
      <Loading label="Loading profiles…">
        <div className="mt-2 space-y-2">
          <Bar className="w-80" />
        </div>
        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <Bar className="w-32" />
          <div className="mt-4 flex items-baseline gap-3">
            <Bar className="w-1/3" />
            <Bar className="w-1/3" />
            <Bar className="w-24" />
          </div>
        </div>
        <div className="mt-8 space-y-6">
          <ProfileCard rows={2} />
          <ProfileCard rows={1} />
        </div>
      </Loading>
    </main>
  );
}
