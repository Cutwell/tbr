import { cn } from "@/lib/utils/cn";

interface StatFigureProps {
  value: string | number;
  label: string;
  tone?: string;
  className?: string;
}

/**
 * A single large figure with a mono caption. The oversized numeral is the main
 * source of typographic contrast in the masthead.
 */
export function StatFigure({ value, label, tone, className }: StatFigureProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span
        style={tone ? { color: tone } : undefined}
        className="font-display u-tnum text-3xl leading-none font-medium md:text-4xl"
      >
        {value}
      </span>
      <span className="u-meta text-ink-faint">{label}</span>
    </div>
  );
}
