import type { Shelf } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const TONE: Record<Shelf, string> = {
  tbr: "bg-shelf-tbr",
  read: "bg-shelf-read",
  dnf: "bg-shelf-dnf",
};

/** The smallest carrier of shelf identity — used wherever a full badge won't fit. */
export function ShelfDot({ shelf, className }: { shelf: Shelf; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", TONE[shelf], className)}
    />
  );
}
