"use client";

import { Chip } from "@/components/atoms/Chip";
import { SHELF_SHORT } from "@/components/molecules/ShelfBadge";
import { SHELVES, type Shelf } from "@/lib/types";

interface FilterBarProps {
  active: Shelf | null;
  counts: Record<Shelf, number>;
  total: number;
  onChange: (shelf: Shelf | null) => void;
}

/**
 * Shelf filter. `null` means "everything".
 *
 * Counts sit inside the chips rather than in a separate summary line: the
 * shape of a reading life — mostly read, a long tail of intentions — is the
 * most interesting thing about this data, and it should be visible without
 * clicking anything.
 */
export function FilterBar({ active, counts, total, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by shelf">
      <Chip selected={active === null} count={total} onClick={() => onChange(null)}>
        All
      </Chip>
      {SHELVES.map((shelf) => (
        <Chip
          key={shelf}
          selected={active === shelf}
          count={counts[shelf]}
          onClick={() => onChange(active === shelf ? null : shelf)}
        >
          {SHELF_SHORT[shelf]}
        </Chip>
      ))}
    </div>
  );
}
