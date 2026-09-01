import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  /** Optional trailing count, set in tabular figures so widths stay stable. */
  count?: number;
  /** Accent colour for the selected state — a shelf token, usually. */
  tone?: string;
  children: ReactNode;
}

/**
 * A pressable filter chip.
 *
 * Selection is carried by `aria-pressed` and a filled ground rather than by a
 * checkmark, so the row reads as a set of switches at a glance.
 */
export function Chip({
  selected = false,
  count,
  tone,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      style={selected && tone ? { backgroundColor: tone, borderColor: tone } : undefined}
      className={cn(
        "u-meta inline-flex items-center gap-2 rounded-[3px] border px-3 py-1.5",
        "transition-[background-color,border-color,color] duration-150",
        selected
          ? "border-ink bg-ink text-paper"
          : "border-rule-strong text-ink-soft hover:border-ink-faint hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
      {typeof count === "number" && (
        <span className={cn("u-tnum tabular-nums", selected ? "opacity-70" : "opacity-55")}>
          {count}
        </span>
      )}
    </button>
  );
}
