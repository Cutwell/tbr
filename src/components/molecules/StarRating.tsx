"use client";

import { useState } from "react";
import { Star } from "@/components/atoms/Star";
import type { Rating } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const VALUES: Rating[] = [1, 2, 3, 4, 5];

interface StarRatingProps {
  value?: Rating;
  onChange?: (rating: Rating | undefined) => void;
  size?: number;
  /** Renders as static output with no interaction affordances. */
  readOnly?: boolean;
  className?: string;
}

/**
 * Star rating.
 *
 * Clicking the current rating clears it — the alternative is a separate
 * "remove rating" control for something readers do often enough to matter, and
 * the toggle is discoverable within one click.
 */
export function StarRating({
  value,
  onChange,
  size = 14,
  readOnly = false,
  className,
}: StarRatingProps) {
  const [hovered, setHovered] = useState<Rating | null>(null);
  const shown = hovered ?? value ?? 0;

  if (readOnly) {
    return (
      <span
        className={cn("inline-flex gap-0.5 text-accent", className)}
        aria-label={value ? `Rated ${value} out of 5` : "Not rated"}
      >
        {VALUES.map((star) => (
          <Star key={star} filled={star <= (value ?? 0)} size={size} />
        ))}
      </span>
    );
  }

  return (
    <span
      className={cn("inline-flex gap-0.5 text-accent", className)}
      onMouseLeave={() => setHovered(null)}
    >
      {VALUES.map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
          aria-pressed={value === star}
          onMouseEnter={() => setHovered(star)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(null)}
          onClick={() => onChange?.(value === star ? undefined : star)}
          className="cursor-pointer p-px transition-transform duration-150 hover:scale-115"
        >
          <Star filled={star <= shown} size={size} />
        </button>
      ))}
    </span>
  );
}
