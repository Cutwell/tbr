import { cn } from "@/lib/utils/cn";

interface SkeletonProps {
  className?: string;
  /** Staggers the pulse across a group so it reads as one surface, not a strobe. */
  delay?: number;
}

/**
 * A placeholder block.
 *
 * Skeletons here are deliberately dim — `paper-sunk` on `paper`, a barely-there
 * step. A high-contrast skeleton draws the eye to what is missing; this one
 * holds the shape so the layout stops moving, then gets out of the way.
 */
export function Skeleton({ className, delay = 0 }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      className={cn("animate-pulse rounded-[2px] bg-paper-sunk", className)}
    />
  );
}

/** A run of text lines, last one short so it reads as a paragraph. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          delay={index * 90}
          className={cn("h-3.5", index === lines - 1 ? "w-2/5" : "w-full")}
        />
      ))}
    </div>
  );
}
