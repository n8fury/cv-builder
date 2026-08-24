"use client";

/**
 * Drag-to-reorder primitives (SPEC §7).
 *
 * `@dnd-kit/core` + `@dnd-kit/sortable`, wrapped once so the three levels the
 * editor reorders — sections, entries, bullets — all behave the same way and
 * all report a move as a pair of IDs rather than as pixels.
 *
 * Dragging starts from an explicit handle, never from the row: every row here
 * is full of checkboxes and textareas, and a row-wide drag listener would
 * fight the controls it contains. The handle is a real `<button>`, so dnd-kit's
 * keyboard sensor makes every reorder doable from the keyboard too.
 *
 * Each list gets its own `DndContext`. Bullet IDs are unique only within their
 * entry (the seed library already repeats one), so a single context spanning a
 * whole section would see duplicate draggable IDs; one context per list keeps
 * the uniqueness requirement local, where it holds.
 */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useId, type CSSProperties, type ReactNode } from "react";

/** A vertical stack, or a wrapped row of chips (Technical Skills, §5.7). */
export type SortableLayout = "vertical" | "wrap";

export function SortableList({
  ids,
  onMove,
  layout = "vertical",
  children,
}: {
  ids: string[];
  /** Called with the dragged item's ID and the ID it was dropped onto. */
  onMove: (fromId: string, toId: string) => void;
  layout?: SortableLayout;
  children: ReactNode;
}) {
  // dnd-kit numbers its ARIA description element from a module-level counter,
  // which server and client do not walk in the same order — the editor is
  // server-rendered, so without a stable id every list hydrates mismatched.
  const contextId = useId();
  const sensors = useSensors(
    // A few pixels of travel before a drag begins, so a click that lands on
    // the handle stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onMove(String(active.id), String(over.id));
  }

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={ids}
        strategy={layout === "wrap" ? rectSortingStrategy : verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
}

export interface SortableRow {
  ref: (node: HTMLElement | null) => void;
  style: CSSProperties;
  dragging: boolean;
  handleProps: Record<string, unknown>;
}

/**
 * The props one sortable row needs. Returned rather than rendered, because the
 * three call sites wrap different elements (`<li>`, a row, a chip) and carry
 * their own test hooks.
 */
export function useSortableRow(id: string, layout: SortableLayout = "vertical"): SortableRow {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  // A vertical list only ever moves on one axis; letting the row drift
  // sideways under the cursor just makes the drop target harder to read.
  const shift = transform && layout === "vertical" ? { ...transform, x: 0 } : transform;

  return {
    ref: setNodeRef,
    style: {
      transform: CSS.Translate.toString(shift),
      transition,
      // Lifted above its neighbours, so the row being dragged stays readable
      // as the others slide past it.
      position: isDragging ? "relative" : undefined,
      zIndex: isDragging ? 1 : undefined,
      opacity: isDragging ? 0.85 : undefined,
    },
    dragging: isDragging,
    handleProps: { ...attributes, ...listeners },
  };
}

export function DragHandle({
  label,
  className = "",
  handleProps,
}: {
  label: string;
  className?: string;
  handleProps: Record<string, unknown>;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-drag-handle
      // `touch-none` is required, not cosmetic: without it a touch drag is
      // eaten by the browser's own scrolling before the sensor sees it.
      className={`cursor-grab touch-none select-none rounded px-1 leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing ${className}`}
      {...handleProps}
    >
      ⠿
    </button>
  );
}
