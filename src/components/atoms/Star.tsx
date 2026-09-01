import { cn } from "@/lib/utils/cn";

interface StarProps {
  filled: boolean;
  size?: number;
  className?: string;
}

/**
 * A single star. Filled and empty share one path, differing only in fill — so
 * the silhouette never shifts as a rating changes.
 */
export function Star({ filled, size = 14, className }: StarProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn("transition-colors duration-150", className)}
    >
      <path
        d="M12 2.6l2.9 6.1 6.6.9-4.8 4.7 1.2 6.7L12 17.8 6.1 21l1.2-6.7L2.5 9.6l6.6-.9L12 2.6Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.5}
        strokeLinejoin="round"
        opacity={filled ? 1 : 0.4}
      />
    </svg>
  );
}
