"use client";

/**
 * The jump rail at the head of the editor's form (SPEC §7, §15.3).
 *
 * A row of chips, one per section the column is showing, in the variant's own
 * order. Pressing one puts that card at the top of the screen. It is the
 * navigation half of the no-collapse decision (`./rail`): the cards stay open,
 * so the column is long, so the way to the far end of it must be one click and
 * not a scroll.
 *
 * It sticks to the top of the column, because a rail you have to scroll back
 * up to find is not a shortcut. Its measured height is published as
 * `--rail-top` by the form above it, and the sticky section headers stick to
 * that line rather than to the viewport — measured rather than hardcoded
 * because a horizontal scrollbar appears under a narrow column and takes real
 * height with it.
 *
 * A chip is a jump and nothing else. It does not toggle the section, and it
 * does not reorder it — the drag handle on the card is still the only thing
 * that writes an order (§15.3) — so nothing here can produce a draft change or
 * an undo step. Hidden sections keep their chip, dimmed: a section switched
 * off is the one you are most likely to be on your way to.
 *
 * There is deliberately no "current section" highlight. Answering it means
 * watching the scroll position, and every answer re-renders the form — the
 * expensive tree, with the whole library in it — on a wheel tick. The sticky
 * header already names where you are, permanently and without a listener.
 */
import { useEffect, useRef } from "react";

import type { RailItem } from "./rail";

const CHIP =
  "shrink-0 rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900";

export function SectionRail({
  items,
  onHeight,
}: {
  items: RailItem[];
  /** The rail's own height in pixels, remeasured whenever the box changes. */
  onHeight: (px: number) => void;
}) {
  const ref = useRef<HTMLElement | null>(null);

  // A single chip is not a shortcut to anywhere, and no chips is not a rail:
  // a control that can do nothing should not be drawn (`TagActions`' rule).
  const drawn = items.length > 1;

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      onHeight(0);
      return;
    }
    const observer = new ResizeObserver(() => onHeight(node.getBoundingClientRect().height));
    observer.observe(node);
    onHeight(node.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [drawn, onHeight]);

  if (!drawn) return null;

  return (
    <nav
      aria-label="Jump to a section"
      className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-gray-200 bg-white px-4 py-2"
      data-rail
      ref={ref}
    >
      <ul className="flex gap-1.5 overflow-x-auto whitespace-nowrap">
        {items.map((item) => (
          <li key={item.key}>
            <button
              className={`${CHIP} ${item.visible ? "text-gray-700" : "text-gray-400"}`}
              data-rail-jump={item.key}
              onClick={() => jumpTo(item.id)}
              title={
                item.visible
                  ? `Jump to the ${item.title} section`
                  : `Jump to the ${item.title} section — hidden in this variant`
              }
              type="button"
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Scroll a card to the top of the column and take the keyboard with it.
 *
 * Straight DOM, as the preview link (§10.4) already is: the target is a card
 * React has rendered and neither the rail nor the store has any business
 * holding a reference to it, and a jump that went through state would re-render
 * the form to move the window. `scroll-margin-top` on the card is what keeps
 * the landing clear of the rail itself.
 *
 * The focus move is not decoration. A scroll leaves the keyboard where it was,
 * so a Tab straight after a jump would walk the section you had just left.
 */
function jumpTo(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;

  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  target.focus({ preventScroll: true });
}
