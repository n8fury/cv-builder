/**
 * Dashboard home (SPEC §7).
 *
 * Lists every profile in the store with its saved variants. Actions (View,
 * Download PDF, Rename, Delete) hang off these rows in the tasks that follow;
 * this is the inventory they attach to.
 */
import Link from "next/link";

import { listDashboard, type ProfileSummary, type VariantSummary } from "@/lib/data/dashboard";
import { editPath, libraryPath, renderPath } from "@/lib/routes";
import {
  deleteProfileAction,
  deleteVariantAction,
  renameProfileAction,
  renameVariantAction,
} from "./actions";
import { DownloadButton } from "./DownloadButton";
import { NewProfileForm } from "./NewProfileForm";
import { DeleteButton, RenameForm } from "./RowActions";

/** Profiles and variants are files on disk that change between requests. */
export const dynamic = "force-dynamic";

/** Fixed locale and zone: the value must not depend on the server's own. */
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : DATE.format(parsed);
}

function VariantRow({ profileId, variant }: { profileId: string; variant: VariantSummary }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
      <span className="font-medium text-gray-900">{variant.label || variant.id}</span>
      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
        {variant.tag}
      </span>
      <span className="ml-auto text-xs text-gray-500">
        Updated <time dateTime={variant.updatedAt}>{formatDate(variant.updatedAt)}</time>
      </span>
      <div className="flex w-full items-baseline gap-3">
        <span className="font-mono text-xs text-gray-400">
          {profileId}/{variant.id}
        </span>
        <Link
          className="ml-auto rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          href={renderPath(profileId, variant.id)}
        >
          View
        </Link>
        <Link
          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          href={editPath(profileId, variant.id)}
        >
          Edit
        </Link>
        <DownloadButton profileId={profileId} variantId={variant.id} />
        <RenameForm
          action={renameVariantAction}
          currentId={variant.id}
          fields={{ profileId, variantId: variant.id }}
          label="New variant name"
        />
        <DeleteButton
          action={deleteVariantAction}
          confirmMessage={`Delete variant "${variant.id}"? This cannot be undone.`}
          fields={{ profileId, variantId: variant.id }}
        />
      </div>
    </li>
  );
}

function ProfileCard({ profile }: { profile: ProfileSummary }) {
  return (
    <section className="rounded-lg border border-gray-200">
      <header className="flex items-baseline gap-3 border-b border-gray-200 px-4 py-3">
        <h2 className="font-semibold text-gray-900">{profile.name || profile.id}</h2>
        <span className="font-mono text-xs text-gray-500">{profile.id}</span>
        <span className="ml-auto text-xs text-gray-500">
          {profile.variants.length} variant{profile.variants.length === 1 ? "" : "s"}
        </span>
        <Link
          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
          href={libraryPath(profile.id)}
        >
          Library
        </Link>
        <RenameForm
          action={renameProfileAction}
          currentId={profile.id}
          fields={{ profileId: profile.id }}
          label="New profile name"
        />
        <DeleteButton
          action={deleteProfileAction}
          confirmMessage={`Delete profile "${profile.id}" and all ${profile.variants.length} of its variants, including its content library? This cannot be undone.`}
          fields={{ profileId: profile.id }}
        />
      </header>

      {profile.error ? (
        <p className="px-4 py-3 text-sm text-red-700">
          Content library unreadable — {profile.error}
        </p>
      ) : null}

      {profile.variants.length === 0 && !profile.error ? (
        <p className="px-4 py-3 text-sm text-gray-500">No variants yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {profile.variants.map((variant) => (
            <VariantRow key={variant.id} profileId={profile.id} variant={variant} />
          ))}
        </ul>
      )}

      {profile.broken.length > 0 ? (
        <ul className="border-t border-gray-100 px-4 py-3 text-sm text-red-700">
          {profile.broken.map((entry) => (
            <li key={entry.id}>
              <span className="font-mono">{entry.id}</span> — unreadable: {entry.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default async function Home() {
  const profiles = await listDashboard();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold text-gray-900">CV Builder</h1>
      <p className="mt-1 text-sm text-gray-600">
        Profiles and their saved variants, read from <code>data/profiles/</code>.
      </p>

      <div className="mt-6">
        <NewProfileForm />
      </div>

      {profiles.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          No profiles yet.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {profiles.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </main>
  );
}
