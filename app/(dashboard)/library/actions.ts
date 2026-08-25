"use server";

/**
 * Library-manager mutations (SPEC §7, §11.4, §12.7).
 *
 * Each action reads the library off disk, applies one pure edit from
 * `lib/data/library-edit.ts`, and writes it back through the store's atomic
 * replace. Read-modify-write rather than accepting a whole library from the
 * client: this screen changes one item at a time, and posting the entire file
 * back would let a stale tab overwrite an edit made in the variant editor
 * since it loaded.
 *
 * Nothing here touches a variant. An edit propagates because a variant holds
 * IDs and no text (§6.2) — rewriting the library *is* the propagation (§11.4).
 */
import { revalidatePath } from "next/cache";

import { generateId, libraryIds } from "@/lib/data/ids";
import {
  deleteItem,
  forkItem,
  itemAndDescendantIds,
  parseTags,
  setItemTags,
  updateItemFields,
} from "@/lib/data/library-edit";
import { ITEM_FIELDS, type LibraryItemKind } from "@/lib/data/library-index";
import {
  blockingVariants,
  indexReferences,
  type NamedVariant,
} from "@/lib/data/orphans";
import { listVariants, readLibrary, readVariant, writeLibrary, writeVariant } from "@/lib/data/store";
import { repointVariant, variantReferencedIds } from "@/lib/data/variant-refs";
import type { ContentLibrary } from "@/lib/schema/library";

import { IDLE, type ActionState } from "../action-state";

function fail(message: string): ActionState {
  return { error: message };
}

function field(form: FormData, name: string): string {
  return String(form.get(name) ?? "");
}

/**
 * A library edit reaches every variant that references the item, so every
 * screen that renders one is stale afterwards — the dashboard, the editor and
 * each `/render` page alike. Invalidating the whole tree is the honest
 * response to that; this is a single-user local app, and a targeted list would
 * be a list to forget to update.
 */
function refresh(): void {
  revalidatePath("/", "layout");
}

async function mutate(
  profileId: string,
  edit: (library: ContentLibrary) => ContentLibrary,
): Promise<ActionState> {
  try {
    const library = await readLibrary(profileId);
    await writeLibrary(profileId, edit(library));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  refresh();
  return IDLE;
}

/**
 * Rewrites one item's text — the propagating edit of §11.4.
 *
 * The form posts only the fields the manager declares for that kind, and
 * `updateItemFields` writes only those, so the item's ID, tags and nested
 * bullets survive an edit untouched.
 */
export async function updateItemAction(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const profileId = field(form, "profileId").trim();
  const id = field(form, "itemId").trim();
  const kind = field(form, "kind").trim() as LibraryItemKind;

  if (!id) return fail("An item id is required.");
  const spec = ITEM_FIELDS[kind];
  if (!spec) return fail(`Unknown item kind: ${kind}`);

  const values: Record<string, string> = {};
  for (const declared of spec) values[declared.name] = field(form, `field.${declared.name}`);

  // Tags ride along with the text rather than having their own button: they
  // are one property of one item, and two saves on one row would leave the
  // person guessing which one they had just pressed (§6.1).
  const tags = parseTags(field(form, "tags"));

  return mutate(profileId, (library) => setItemTags(updateItemFields(library, id, values), id, tags));
}

/** Every variant on disk, which is what "referenced by no variant" means (§7). */
async function readAllVariants(profileId: string): Promise<NamedVariant[]> {
  const ids = await listVariants(profileId);
  const read = await Promise.all(
    ids.map(async (id) => {
      try {
        return { id, variant: await readVariant(profileId, id) };
      } catch {
        // An unreadable variant is reported on the dashboard (§13). Here it
        // must not read as "references nothing" — see `deleteItemAction`.
        return null;
      }
    }),
  );
  return read.filter((entry) => entry !== null);
}

/**
 * Deletes a library item, unless a variant still references it (§7).
 *
 * The block names the variants, because "cannot delete" without them leaves
 * the person opening every variant to find out which. Deleting anyway would
 * leave those variants pointing at an ID the library lacks, which the resolver
 * refuses to render (§13) — the CV would break, not merely lose a line.
 *
 * Nested IDs are checked too: removing an entry takes its bullets with it, and
 * a variant naming one of those bullets would break just the same.
 */
export async function deleteItemAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const profileId = field(form, "profileId").trim();
  const id = field(form, "itemId").trim();
  if (!id) return fail("An item id is required.");

  try {
    const [library, variants] = await Promise.all([
      readLibrary(profileId),
      listVariants(profileId),
    ]);

    // A variant that will not parse is a variant whose references cannot be
    // read. Refusing to delete while one is broken is the safe answer: the
    // alternative is deleting an item it may well have been using.
    const named = await readAllVariants(profileId);
    if (named.length !== variants.length) {
      const broken = variants.filter((v) => !named.some((entry) => entry.id === v));
      return fail(
        `Cannot check references while ${broken.join(", ")} is unreadable — fix it first.`,
      );
    }

    const references = indexReferences(named);
    const blocked = new Set<string>();
    for (const nested of itemAndDescendantIds(library, id)) {
      for (const variantId of blockingVariants(references, nested)) blocked.add(variantId);
    }

    if (blocked.size > 0) {
      return fail(
        `Still used by ${[...blocked].sort().join(", ")} — remove it there first, or fork it.`,
      );
    }

    await writeLibrary(profileId, deleteItem(library, id));
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  refresh();
  return IDLE;
}

/**
 * Forks one item and repoints a single variant at the copy (§11.4).
 *
 * Two files change and they have to agree, so both are written here rather
 * than through `mutate`: the library gains the copy, and the one variant named
 * by `variantId` swaps its reference for the new ID. Every other variant is
 * not read, not written, and keeps rendering the original — which is the
 * entire point of forking instead of editing.
 *
 * The variant is written first. If that fails, the library is untouched and
 * nothing has happened; the other order would leave an unreferenced copy
 * behind — the orphaned cruft §7's manager exists to clean up.
 */
export async function forkItemAction(_state: ActionState, form: FormData): Promise<ActionState> {
  const profileId = field(form, "profileId").trim();
  const id = field(form, "itemId").trim();
  const variantId = field(form, "variantId").trim();

  if (!id) return fail("An item id is required.");
  if (!variantId) {
    return fail("Choose which variant the fork should apply to before forking.");
  }

  try {
    const [library, variant] = await Promise.all([
      readLibrary(profileId),
      readVariant(profileId, variantId),
    ]);

    if (!variantReferencedIds(variant).has(id)) {
      return fail(`Variant ${variantId} does not use this item, so there is nothing to repoint.`);
    }

    // IDs are checked against the whole library and against each other, so a
    // forked entry's bullets cannot collide with the copy or with the original.
    const taken = new Set(libraryIds(library));
    const generate = (kind: LibraryItemKind): string => {
      const next = generateId(kind, taken);
      taken.add(next);
      return next;
    };

    const { library: forked, replacements } = forkItem(library, id, generate);
    await writeVariant(profileId, variantId, repointVariant(variant, replacements));
    await writeLibrary(profileId, forked);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  refresh();
  return IDLE;
}
