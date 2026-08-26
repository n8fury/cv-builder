"use client";

/**
 * One section in the editor's left column (SPEC §7, §11.4).
 *
 * The row names the section, toggles whether it renders at all, and carries
 * whatever `options` that section type has (§12.2). Beneath it, sections with
 * bullets expose each curated bullet as a text field. A bullet's text belongs
 * to the library, not the variant (§6.2), so those fields edit the library
 * draft — exactly the propagating edit §11.4 describes, staged until Save.
 *
 * The card's own header row is sticky: it names the section, and carries its
 * Visible box, for as long as any part of the card is on screen. It stops at
 * the jump rail rather than at the viewport (`--rail-top`, `./rail`), and lets
 * go while the card is being dragged.
 *
 * The card is also where the form's text filter lands. It arrives as a pair of
 * ID sets (`filter.ts`) and is applied to the lists this file builds, not
 * inside the curation components: those two already take "the entries" and
 * "their bullets" as their input, so a filtered card is the same components
 * fed a shorter library. Nothing about a row changes because it is being shown
 * under a filter.
 */
import { headerFieldValues, normalizeLinkUrl } from "@/lib/data/header-edit";
import { NEW_BULLET, NEW_ENTRY, NEW_HEADER_LINK } from "@/lib/data/new-items";
import type { ContentLibrary } from "@/lib/schema/library";
import type { VariantSection } from "@/lib/schema/variant";

import { BulkActions } from "./BulkActions";
import { BulletField } from "./BulletField";
import { EntryCuration, type EntryChoice } from "./EntryCuration";
import { useEditor } from "./EditorStoreProvider";
import { NewItemForm } from "./NewItemForm";
import { DragHandle, useSortableRow } from "./Sortable";
import { SkillCuration, type SkillGroupChoice } from "./SkillCuration";
import { TagActions } from "./TagActions";
import { SHOW_ALL, filterNote, type SectionFilter } from "./filter";
import { ordered } from "./ordering";
import { sectionLabel } from "./rail";
import { useLinkHover } from "./preview-link";

const SELECT = "rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-900";
const FIELD =
  "w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-gray-500 focus:outline-none";
const GHOST = "rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800";

/** A reference the library cannot satisfy is named, not hidden (§13). */
function MissingRef({ id }: { id: string }) {
  return (
    <p className="text-xs text-red-700">
      <span className="font-mono">{id}</span> — not in the library
    </p>
  );
}

/**
 * The header's own content, edited in the editor (SPEC §5.1, §16.6).
 *
 * The header is library content — one record shared by every variant — so
 * these fields write the library draft and propagate exactly as a bullet's
 * text does (§11.4). It is edited here rather than only in the library manager
 * because the header is the one block on the page the editor could show but
 * not fix; the propagation warning below is what the manager's separate screen
 * used to say implicitly by being somewhere else.
 *
 * Values are trimmed on blur, not on every keystroke: these all print inside a
 * pipe-separated contact line where a stray space shifts a centered line, but
 * trimming as you type would make the space bar appear broken.
 */
function HeaderFields({ library }: { library: ContentLibrary }) {
  const setHeaderField = useEditor((state) => state.setHeaderField);
  const setHeaderLinkText = useEditor((state) => state.setHeaderLinkText);
  const setHeaderLinkUrl = useEditor((state) => state.setHeaderLinkUrl);
  const removeHeaderLink = useEditor((state) => state.removeHeaderLink);
  const addHeaderLink = useEditor((state) => state.addHeaderLink);

  return (
    <div className="space-y-2 border-t border-gray-100 px-3 py-2">
      <p className="text-xs text-gray-500">
        One header per profile — editing it changes every variant.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {headerFieldValues(library).map((field) => (
          <label className="block space-y-0.5" key={field.name}>
            <span className="text-xs font-medium text-gray-600">{field.label}</span>
            <input
              className={FIELD}
              data-header-field={field.name}
              name={`header-${field.name}`}
              onBlur={(event) => setHeaderField(field.name, event.target.value.trim())}
              onChange={(event) => setHeaderField(field.name, event.target.value)}
              value={field.value}
            />
          </label>
        ))}
      </div>

      {/* Extra links ride the same printed line as LinkedIn and GitHub, in
          this order (§16.6) — hence a list rather than more named boxes.

          Two boxes per row: the text prints, the URL is what it points at
          (§18.1). The named fields above need no second box because their
          target is derived from what they already say; a portfolio's is not.
          The URL is normalized on blur, not on change — "https://" appearing
          after the first keystroke would fight the person typing. */}
      <div className="space-y-1">
        <span className="text-xs font-medium text-gray-600">
          Other links
          <span className="ml-2 font-normal text-gray-500">printed after GitHub</span>
        </span>
        {library.header.links.map((link) => (
          <div className="space-y-0.5" key={link.id}>
            <div className="flex items-center gap-2">
              <input
                aria-label="Link text"
                className={FIELD}
                data-header-link={link.id}
                onBlur={(event) => setHeaderLinkText(link.id, event.target.value.trim())}
                onChange={(event) => setHeaderLinkText(link.id, event.target.value)}
                placeholder="portfolio.example.com"
                value={link.text}
              />
              <input
                aria-label="Link URL"
                className={FIELD}
                data-header-link-url={link.id}
                onBlur={(event) => setHeaderLinkUrl(link.id, normalizeLinkUrl(event.target.value) ?? "")}
                onChange={(event) => setHeaderLinkUrl(link.id, event.target.value)}
                placeholder="https://portfolio.example.com"
                value={link.url ?? ""}
              />
              <button
                className={GHOST}
                data-remove-link={link.id}
                onClick={() => removeHeaderLink(link.id)}
                type="button"
              >
                Remove
              </button>
            </div>
            <p className="text-xs text-gray-500">
              {link.text.trim() === "" ? (
                "Blank rows are dropped on save."
              ) : link.url ? (
                <>
                  Prints as <span className="text-gray-700">{link.text}</span>, links to{" "}
                  <span className="text-gray-700">{link.url}</span>.
                </>
              ) : (
                <>
                  Prints as <span className="text-gray-700">{link.text}</span> — no URL, so it
                  is not clickable in the PDF.
                </>
              )}
            </p>
          </div>
        ))}
        <NewItemForm spec={NEW_HEADER_LINK} onAdd={addHeaderLink} />
      </div>
    </div>
  );
}

/** One custom-section bullet, pointing the preview at itself as it is edited. */
function CustomBullet({
  bullet,
  entryId,
}: {
  bullet: ContentLibrary["customSections"][number]["bullets"][number];
  entryId: string;
}) {
  const setBulletText = useEditor((state) => state.setBulletText);
  const hover = useLinkHover("bullet", bullet.id);

  return (
    <BulletField
      hover={hover}
      id={bullet.id}
      onChange={(next) => setBulletText("customSections", entryId, bullet.id, next)}
      value={bullet.text}
    />
  );
}

/**
 * A custom section's own text (§12.4). Title and paragraph belong to the
 * library item this section points at, so they are fields rather than
 * toggles — as its bullets already are, for the same reason.
 */
function CustomFields({
  entry,
  index,
}: {
  entry: ContentLibrary["customSections"][number];
  index: number;
}) {
  const setCustomSectionTitle = useEditor((state) => state.setCustomSectionTitle);
  const setCustomSectionParagraph = useEditor((state) => state.setCustomSectionParagraph);
  const addBullet = useEditor((state) => state.addBullet);

  return (
    <div className="space-y-1 border-t border-gray-100 px-3 py-2">
      <label className="block space-y-0.5">
        <span className="text-xs font-medium text-gray-600">Title</span>
        <input
          className={FIELD}
          data-custom-title={entry.id}
          onChange={(event) => setCustomSectionTitle(entry.id, event.target.value)}
          value={entry.title}
        />
      </label>
      <label className="block space-y-0.5">
        <span className="text-xs font-medium text-gray-600">
          Paragraph <span className="font-normal text-gray-400">(optional)</span>
        </span>
        <textarea
          className={`${FIELD} resize-y`}
          data-custom-paragraph={entry.id}
          onChange={(event) => setCustomSectionParagraph(entry.id, event.target.value)}
          rows={2}
          value={entry.paragraph ?? ""}
        />
      </label>
      {/* A custom section's bullets are not curated per variant — the library
          item is the unit (§12.4) — so they get fields, not toggles. */}
      {entry.bullets.map((bullet) => (
        <CustomBullet key={bullet.id} bullet={bullet} entryId={entry.id} />
      ))}
      <NewItemForm spec={NEW_BULLET} onAdd={(values) => addBullet(index, entry.id, values)} />
    </div>
  );
}

/**
 * The entry rows this card shows, and the bullets inside each — the filter
 * applied to a list the card has already built (`filter.ts`).
 *
 * `included` and `includedIds` are left alone throughout. They are the
 * variant's own arrays, and narrowing them would turn a filter into a curation
 * edit; `ordered` drops references it cannot resolve, so a hidden bullet is
 * simply not rendered rather than treated as excluded.
 */
function narrowEntries(entries: EntryChoice[], filter: SectionFilter): EntryChoice[] {
  const { entryIds, bulletIds } = filter;
  if (entryIds === null) return entries;

  return entries
    .filter((entry) => entryIds.has(entry.id))
    .map((entry) =>
      entry.bullets && bulletIds
        ? {
            ...entry,
            bullets: {
              ...entry.bullets,
              all: entry.bullets.all.filter((bullet) => bulletIds.has(bullet.id)),
            },
          }
        : entry,
    );
}

/** The same narrowing one level over: a group is an entry, a skill a bullet. */
function narrowGroups(choices: SkillGroupChoice[], filter: SectionFilter): SkillGroupChoice[] {
  const { entryIds, bulletIds } = filter;
  if (entryIds === null) return choices;

  return choices
    .filter((choice) => entryIds.has(choice.group.id))
    .map((choice) =>
      bulletIds
        ? {
            ...choice,
            group: {
              ...choice.group,
              skills: choice.group.skills.filter((skill) => bulletIds.has(skill.id)),
            },
          }
        : choice,
    );
}

function SectionBody({
  section,
  index,
  library,
  filter,
}: {
  section: VariantSection;
  index: number;
  library: ContentLibrary;
  filter: SectionFilter;
}) {
  const addEntry = useEditor((state) => state.addEntry);
  // Every "Add" is withdrawn while the list is narrowed: a new item is empty,
  // an empty item matches no term, so adding one would create a row and hide
  // it in the same motion.
  const filtering = filter.entryIds !== null;

  switch (section.type) {
    // The header's text, not a curation list: it is one library record every
    // variant renders (§5.1), so the editor edits it in place.
    case "header":
      return <HeaderFields library={library} />;

    case "competencies":
      return (
        <EntryCuration
          filtering={filtering}
          sectionIndex={index}
          newEntry={NEW_ENTRY.competencies}
          entries={narrowEntries(
            ordered(library.competencies, section.items).map((item) => ({
              id: item.id,
              heading: item.text,
              subheading: "",
              included: section.items.includes(item.id),
            })),
            filter,
          )}
        />
      );

    // One branch per collection: a union of two entry shapes would lose the
    // fields that tell them apart.
    case "experience": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          filtering={filtering}
          sectionIndex={index}
          newEntry={NEW_ENTRY.experience}
          entries={narrowEntries(
            ordered(library.experience, includedIds).map((entry) => ({
              id: entry.id,
              heading: entry.title,
              subheading: entry.company,
              included: includedIds.includes(entry.id),
              bullets: {
                all: entry.bullets,
                includedIds: section.entries.find((ref) => ref.id === entry.id)?.bullets ?? [],
                owner: "experience" as const,
              },
            })),
            filter,
          )}
        />
      );
    }

    case "projects": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          filtering={filtering}
          sectionIndex={index}
          newEntry={NEW_ENTRY.projects}
          entries={narrowEntries(
            ordered(library.projects, includedIds).map((entry) => ({
              id: entry.id,
              heading: entry.title,
              subheading: entry.subtitle,
              included: includedIds.includes(entry.id),
              bullets: {
                all: entry.bullets,
                includedIds: section.entries.find((ref) => ref.id === entry.id)?.bullets ?? [],
                owner: "projects" as const,
              },
            })),
            filter,
          )}
        />
      );
    }

    // Entry-level only: no bullet data is passed, so no bullet toggles exist
    // to render (§15.7).
    case "education": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          filtering={filtering}
          sectionIndex={index}
          newEntry={NEW_ENTRY.education}
          entries={narrowEntries(
            ordered(library.education, includedIds).map((entry) => ({
              id: entry.id,
              heading: entry.institution,
              subheading: entry.degree,
              included: includedIds.includes(entry.id),
            })),
            filter,
          )}
        />
      );
    }

    case "certifications": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          filtering={filtering}
          sectionIndex={index}
          newEntry={NEW_ENTRY.certifications}
          entries={narrowEntries(
            ordered(library.certifications, includedIds).map((entry) => ({
              id: entry.id,
              heading: entry.text,
              subheading: entry.dates,
              included: includedIds.includes(entry.id),
            })),
            filter,
          )}
        />
      );
    }

    case "recommendations": {
      const includedIds = section.entries.map((ref) => ref.id);
      return (
        <EntryCuration
          filtering={filtering}
          sectionIndex={index}
          newEntry={NEW_ENTRY.recommendations}
          entries={narrowEntries(
            ordered(library.recommendations, includedIds).map((entry) => ({
              id: entry.id,
              heading: entry.name,
              subheading: [entry.role, entry.location].filter(Boolean).join(" — "),
              included: includedIds.includes(entry.id),
            })),
            filter,
          )}
        />
      );
    }

    case "skills": {
      const includedIds = section.groups.map((ref) => ref.id);
      return (
        <SkillCuration
          filtering={filtering}
          sectionIndex={index}
          choices={narrowGroups(
            ordered(library.skillGroups, includedIds).map((group) => ({
              group,
              included: includedIds.includes(group.id),
              includedSkillIds: section.groups.find((ref) => ref.id === group.id)?.skills ?? [],
            })),
            filter,
          )}
        />
      );
    }

    case "aboutMe":
      return (
        <NewItemForm
          className="border-t border-gray-100 px-3 py-2"
          spec={NEW_ENTRY.aboutMe}
          onAdd={(values) => addEntry(index, values)}
        />
      );

    // Not individually curated — whole-section `visible` only (§12.3, §15.6).
    // A new language still goes to the library; there is simply no per-variant
    // reference to add it to.
    case "languages":
      return (
        <div className="border-t border-gray-100 px-3 py-2">
          <p className="text-xs text-gray-500">
            Every language renders; this section is all-or-nothing.
          </p>
          <NewItemForm spec={NEW_ENTRY.languages} onAdd={(values) => addEntry(index, values)} />
        </div>
      );

    case "custom": {
      const entry = library.customSections.find(
        (item) => item.id === section.options.customSectionId,
      );
      // The pointer is broken, so there is nothing to edit — §13 names it, and
      // the form here repoints *this* section at a replacement rather than
      // adding a further one (which is what the list's own button does).
      if (!entry) {
        return (
          <div className="space-y-1 border-t border-gray-100 px-3 py-2">
            <MissingRef id={section.options.customSectionId} />
            <NewItemForm spec={NEW_ENTRY.custom} onAdd={(values) => addEntry(index, values)} />
          </div>
        );
      }
      return <CustomFields entry={entry} index={index} />;
    }

    default:
      return null;
  }
}

/** The `options` a section type has, if any (§12.2). */
function SectionOptions({
  section,
  index,
  library,
}: {
  section: VariantSection;
  index: number;
  library: ContentLibrary;
}) {
  const setHeaderMode = useEditor((state) => state.setHeaderMode);
  const setHeaderShowTitle = useEditor((state) => state.setHeaderShowTitle);
  const setAboutMeId = useEditor((state) => state.setAboutMeId);
  const setRecommendationsMode = useEditor((state) => state.setRecommendationsMode);
  const setSplitEntries = useEditor((state) => state.setSplitEntries);
  const setCustomSectionId = useEditor((state) => state.setCustomSectionId);

  if (section.type === "header") {
    // The title's text is library content, edited once per profile — in the
    // fields directly below — while whether *this* CV prints it stays a
    // variant decision (§16.6). Disabled with the reason shown rather than
    // hidden, so "why is there no title" has an answer on the screen.
    const title = library.header.title.trim();

    return (
      <div className="flex flex-wrap items-center gap-4 px-3 pb-2 text-xs text-gray-600">
        <label className="flex items-center gap-2">
          Mode
          <select
            className={SELECT}
            name={`header-mode-${index}`}
            value={section.options.mode}
            onChange={(event) =>
              setHeaderMode(index, event.target.value === "minimal" ? "minimal" : "full")
            }
          >
            <option value="full">full</option>
            <option value="minimal">minimal</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <input
            checked={section.options.showTitle}
            disabled={title === ""}
            name={`header-show-title-${index}`}
            onChange={(event) => setHeaderShowTitle(index, event.target.checked)}
            type="checkbox"
          />
          Show title
        </label>

        {title === "" ? (
          <span className="text-gray-500">Fill in Title below to switch it on.</span>
        ) : null}
      </div>
    );
  }

  if (section.type === "aboutMe") {
    return (
      <label className="flex items-center gap-2 px-3 pb-2 text-xs text-gray-600">
        Version
        <select
          className={SELECT}
          name={`about-me-${index}`}
          value={section.options.aboutMeId}
          onChange={(event) => setAboutMeId(index, event.target.value)}
        >
          {library.aboutMe.map((item) => (
            <option key={item.id} value={item.id}>
              {item.key || item.id}
            </option>
          ))}
          {library.aboutMe.some((item) => item.id === section.options.aboutMeId) ? null : (
            <option value={section.options.aboutMeId}>{section.options.aboutMeId} (missing)</option>
          )}
        </select>
      </label>
    );
  }

  // §18.2: off by default, and worded as what it permits rather than what it
  // does — the split only happens where an entry would otherwise leave a hole.
  if (section.type === "experience" || section.type === "projects") {
    return (
      <div className="flex flex-wrap items-center gap-4 px-3 pb-2 text-xs text-gray-600">
        <label className="flex items-center gap-2">
          <input
            checked={section.options.splitEntries}
            name={`split-entries-${index}`}
            onChange={(event) => setSplitEntries(index, event.target.checked)}
            type="checkbox"
          />
          Allow entries to split across pages
        </label>
        <span className="text-gray-500">
          {section.options.splitEntries
            ? "A long entry fills the page and continues overleaf, never leaving a bullet's single line behind."
            : "A long entry moves whole to the next page, even if that leaves a gap."}
        </span>
      </div>
    );
  }

  if (section.type === "recommendations") {
    return (
      <label className="flex items-center gap-2 px-3 pb-2 text-xs text-gray-600">
        Mode
        <select
          className={SELECT}
          name={`recommendations-mode-${index}`}
          value={section.options.mode}
          onChange={(event) =>
            setRecommendationsMode(index, event.target.value === "expanded" ? "expanded" : "collapsed")
          }
        >
          <option value="collapsed">collapsed</option>
          <option value="expanded">expanded</option>
        </select>
      </label>
    );
  }

  if (section.type === "custom") {
    return (
      <label className="flex items-center gap-2 px-3 pb-2 text-xs text-gray-600">
        Content
        <select
          className={SELECT}
          name={`custom-section-${index}`}
          value={section.options.customSectionId}
          onChange={(event) => setCustomSectionId(index, event.target.value)}
        >
          {library.customSections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title || item.id}
            </option>
          ))}
          {library.customSections.some((item) => item.id === section.options.customSectionId) ? null : (
            <option value={section.options.customSectionId}>
              {section.options.customSectionId} (missing)
            </option>
          )}
        </select>
      </label>
    );
  }

  return null;
}

export function SectionCard({
  section,
  index,
  library,
  sortId,
  /** Where the jump rail lands (`./rail`). Absent outside the form's list. */
  domId,
  /** Defaults to the whole section, which is what an unfiltered form asks for. */
  filter = SHOW_ALL,
}: {
  section: VariantSection;
  index: number;
  library: ContentLibrary;
  sortId: string;
  domId?: string;
  filter?: SectionFilter;
}) {
  const setSectionVisible = useEditor((state) => state.setSectionVisible);
  const removeSection = useEditor((state) => state.removeSection);
  const { ref, style, dragging, handleProps } = useSortableRow(sortId);
  const title = sectionLabel(section, library);
  const note = filterNote(library, section, filter);

  return (
    <li
      ref={ref}
      // `--rail-top` is the sticky rail's measured height, published by the
      // form (`VariantForm`). Without the scroll margin a jump would tuck the
      // card's own header underneath the rail it was pressed on.
      style={{ ...style, scrollMarginTop: "var(--rail-top, 0px)" }}
      data-section={section.type}
      data-index={index}
      id={domId}
      // A jump moves the keyboard here as well as the window (`SectionRail`),
      // and a card is not otherwise focusable. Programmatic only: it must not
      // become a stop in the Tab order the form already has.
      tabIndex={-1}
      className={`${section.visible ? "bg-white" : "bg-gray-50"} ${dragging ? "shadow-lg" : ""} focus:outline-none`}
    >
      {/* Sticky, so the section you are inside keeps saying which one it is —
          and keeps its Visible box within reach — however far down its own
          rows you have scrolled. It stops at the rail, not at the viewport.

          Released while the card is being dragged: dnd-kit moves the row with
          a transform, and a header pinned to the viewport inside a row that is
          following the cursor would tear away from it. `bg-inherit` takes the
          card's own white or grey, which is what makes it opaque over the rows
          it passes. */}
      <div
        className={`flex items-baseline gap-2 bg-inherit px-3 py-2 ${dragging ? "" : "sticky z-10"}`}
        style={dragging ? undefined : { top: "var(--rail-top, 0px)" }}
      >
        <DragHandle label={`Reorder ${title} section`} handleProps={handleProps} />
        <span className={`text-sm ${section.visible ? "text-gray-900" : "text-gray-400"}`}>
          {title}
        </span>
        <span className="font-mono text-xs text-gray-400">{section.type}</span>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            name={`visible-${index}`}
            checked={section.visible}
            onChange={(event) => setSectionVisible(index, event.target.checked)}
          />
          Visible
        </label>
        {/* Custom sections only: the fixed types are switched off with
            `visible` and can be switched back on, so removing one would take
            away a section the editor could not offer back. */}
        {section.type === "custom" ? (
          <button
            className={GHOST}
            data-remove-section={index}
            onClick={() => removeSection(index)}
            title="Remove this section from the variant"
            type="button"
          >
            Remove
          </button>
        ) : null}
      </div>
      <SectionOptions section={section} index={index} library={library} />
      {/* Above the list, not inside it: these act on the whole section, and
          the counts they show are read off the list below them (§6.1). */}
      <BulkActions section={section} index={index} library={library} filter={filter} />
      <TagActions section={section} index={index} library={library} />
      {/* What the filter is holding back, said on the card that is holding it
          back. A shortened list read as the whole list is how someone rewords
          the one bullet they can see believing it is the only one. */}
      {note ? (
        <p className="px-3 pb-2 text-xs text-amber-700" data-filter-note>
          {note}
        </p>
      ) : null}
      {/* Shown for hidden sections too: curation is often prepared before a
          section is switched back on, and collapsing it would shuffle the
          whole column on every toggle. */}
      <SectionBody section={section} index={index} library={library} filter={filter} />
    </li>
  );
}
