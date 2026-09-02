"use client";

import { SORTS, sortLabel, type SortKey } from "@/lib/store/shelfView";
import type { Shelf } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

interface SortControlProps {
  value: SortKey;
  /** The shelf currently showing — it names the date sort. */
  shelf: Shelf | null;
  onChange: (sort: SortKey) => void;
}

/**
 * How the grid is arranged.
 *
 * A joined segmented control rather than the loose chips the shelf filter uses,
 * and the difference is doing real work: the two rows sit side by side, both
 * are small mono capitals, and if they looked alike a reader would have to read
 * them to tell filtering from ordering. One set of separate pills, one welded
 * strip.
 *
 * Options are always all three, never a dropdown. Three is below the count
 * where hiding choices behind a click starts to pay, and a visible row lets the
 * date option relabel itself — "Finished" on the read shelf, "Added" on tbr —
 * which is the whole reason it is comprehensible at all.
 */
export function SortControl({ value, shelf, onChange }: SortControlProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span id="sort-label" className="u-meta text-ink-faint">
        Arrange
      </span>
      <div
        role="group"
        aria-labelledby="sort-label"
        className="flex overflow-hidden rounded-[3px] border border-rule-strong"
      >
        {SORTS.map((sort) => (
          <button
            key={sort}
            type="button"
            onClick={() => onChange(sort)}
            aria-pressed={value === sort}
            className={cn(
              "u-meta border-l border-rule px-2.5 py-1.5 first:border-l-0",
              "transition-colors duration-150",
              value === sort
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-paper-sunk hover:text-ink",
            )}
          >
            {sortLabel(sort, shelf)}
          </button>
        ))}
      </div>
    </div>
  );
}
