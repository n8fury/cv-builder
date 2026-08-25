/**
 * The library manager's browse view (SPEC §7, §12.7).
 *
 * Every item in a profile's content library, grouped by type, each showing its
 * ID and tags and opening into an edit form. This is deliberately a separate
 * screen from the variant editor: the editor asks "what goes in *this* CV",
 * while this asks "what has this person written" — the same items, but nothing
 * here is scoped to one variant, and an edit made here reaches all of them
 * (§11.4).
 *
 * The ID is on every row because it is what a variant references (§11.4) and
 * therefore what a hand-edited variant file or an n8n draft (§10) will name.
 */
import {
  deleteItemAction,
  forkItemAction,
  updateItemAction,
} from "@/app/(dashboard)/library/actions";
import type { LibraryGroup, LibraryItem } from "@/lib/data/library-index";
import type { ReferenceIndex } from "@/lib/data/orphans";

import { DeleteItemButton } from "./DeleteItemButton";
import { ForkButton } from "./ForkButton";
import { ItemForm } from "./ItemForm";

/** What each kind is called in "Fork this …" (§11.4). */
const NOUN: Record<LibraryItem["kind"], string> = {
  aboutMe: "paragraph",
  competency: "competency",
  experience: "job",
  project: "project",
  education: "entry",
  skillGroup: "group",
  skill: "skill",
  certification: "certification",
  recommendation: "reference",
  language: "language",
  customSection: "section",
  bullet: "bullet",
};

/** The variant the per-variant actions act on, and what it references. */
export interface Scope {
  variantId: string | null;
  referenced: ReadonlySet<string>;
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) {
    return <span className="text-xs text-gray-400">no tags</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700"
        >
          {tag}
        </span>
      ))}
    </span>
  );
}

function ItemRow({
  item,
  profileId,
  references,
  scope,
  nested = false,
}: {
  item: LibraryItem;
  profileId: string;
  references: ReferenceIndex;
  scope: Scope;
  nested?: boolean;
}) {
  const usedBy = references.get(item.id) ?? [];

  return (
    <li className={nested ? "py-1.5 pl-6" : "py-2"}>
      {/* A collapsed row by default: the library holds every bullet the person
          has ever written, and expanding all of them at once would bury the
          list this screen exists to scan. */}
      <details>
        <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={nested ? "text-sm text-gray-700" : "text-sm font-medium text-gray-900"}>
            {item.title}
          </span>
          <span className="font-mono text-xs text-gray-400">{item.id}</span>
          {usedBy.length === 0 ? (
            // §7: an item no variant reaches is exactly the cruft this screen
            // exists to find, so it is labelled in the list, not on inspection.
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
              orphaned
            </span>
          ) : null}
          <span className="ml-auto">
            <Tags tags={item.tags} />
          </span>
        </summary>
        <ItemForm action={updateItemAction} item={item} profileId={profileId} />
        <p className="mt-2 text-xs text-gray-500">
          {usedBy.length === 0
            ? "Referenced by no variant."
            : `Used by ${usedBy.join(", ")}.`}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <ForkButton
            action={forkItemAction}
            itemId={item.id}
            noun={NOUN[item.kind]}
            profileId={profileId}
            usedByVariant={scope.referenced.has(item.id)}
            variantId={scope.variantId}
          />
          <DeleteItemButton
            action={deleteItemAction}
            itemId={item.id}
            profileId={profileId}
            usedBy={usedBy}
          />
        </div>
      </details>

      {item.children.length > 0 ? (
        <ul className="mt-1 border-l border-gray-200">
          {item.children.map((child) => (
            <ItemRow
              key={`${item.id}/${child.id}`}
              item={child}
              profileId={profileId}
              references={references}
              scope={scope}
              nested
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Group({
  group,
  profileId,
  references,
  scope,
}: {
  group: LibraryGroup;
  profileId: string;
  references: ReferenceIndex;
  scope: Scope;
}) {
  return (
    <section className="rounded-lg border border-gray-200">
      <header className="flex items-baseline gap-3 border-b border-gray-200 px-4 py-2">
        <h2 className="font-semibold text-gray-900">{group.label}</h2>
        <span className="ml-auto text-xs text-gray-500">
          {group.items.length} item{group.items.length === 1 ? "" : "s"}
        </span>
      </header>
      {group.items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-500">Nothing in the library yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 px-4 py-1">
          {group.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              profileId={profileId}
              references={references}
              scope={scope}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export function LibraryBrowser({
  groups,
  profileId,
  references,
  scope,
}: {
  groups: LibraryGroup[];
  profileId: string;
  references: ReferenceIndex;
  scope: Scope;
}) {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <Group
          key={group.collection}
          group={group}
          profileId={profileId}
          references={references}
          scope={scope}
        />
      ))}
    </div>
  );
}
