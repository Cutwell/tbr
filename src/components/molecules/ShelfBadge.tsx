import { ShelfDot } from "@/components/atoms/ShelfDot";
import type { Shelf } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

export const SHELF_LABEL: Record<Shelf, string> = {
  tbr: "To read",
  read: "Read",
  dnf: "Gave up",
};

/** Short forms for chips and dense metadata rows. */
export const SHELF_SHORT: Record<Shelf, string> = {
  tbr: "TBR",
  read: "Read",
  dnf: "DNF",
};

const TONE: Record<Shelf, string> = {
  tbr: "text-shelf-tbr",
  read: "text-shelf-read",
  dnf: "text-shelf-dnf",
};

export function ShelfBadge({ shelf, className }: { shelf: Shelf; className?: string }) {
  return (
    <span className={cn("u-meta inline-flex items-center gap-1.5", TONE[shelf], className)}>
      <ShelfDot shelf={shelf} />
      {SHELF_SHORT[shelf]}
    </span>
  );
}
