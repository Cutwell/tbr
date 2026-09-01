"use client";

import { useState } from "react";
import { coverUrl, type CoverSize } from "@/lib/catalog/openlibrary";
import { cn } from "@/lib/utils/cn";

interface BookCoverProps {
  title: string;
  author: string;
  coverId?: number;
  /**
   * Which Open Library rendition to fetch. Measured: M is 180x294 (12KB), L is
   * 305x500 (26KB). L is the default because a 190px grid cell on a 2x display
   * needs ~380px, and M visibly softens there.
   */
  size?: CoverSize;
  priority?: boolean;
  className?: string;
}


/**
 * A book cover, with a typographic fallback.
 *
 * A plain `<img>` rather than `next/image`. A cover URL answers 302 into
 * archive.org and then into a per-region host, so routing it through the image
 * optimiser makes every cover depend on the *server* resolving that redirect
 * chain — which fails outright in some environments. Once images are loaded
 * directly, `next/image` contributes nothing that native `loading="lazy"` and
 * CSS do not.
 *
 * A single rendition, deliberately: a `srcset` here made the browser re-pick a
 * candidate once layout resolved `sizes`, and each re-pick aborted the request
 * in flight — reporting a *successful* load with nothing decoded, which drove
 * covers into the fallback that had loaded perfectly well. One URL, one
 * request, no re-picks. The bytes saved on small screens were not worth
 * randomly losing cover art on the shelf.
 *
 * Roughly one work in twenty-five has no cover art, and a wall of grey
 * placeholder boxes would undercut the entire design. The fallback sets the
 * title in the display face on a sunk paper ground — it reads as a plain
 * clothbound edition rather than as missing data. Open Library also
 * occasionally serves a blank for a cover id that no longer resolves, so a load
 * error falls through to the same treatment.
 */
export function BookCover({
  title,
  author,
  coverId,
  size = "L",
  priority = false,
  className,
}: BookCoverProps) {
  const src = coverId ? coverUrl(coverId, size) : undefined;

  /**
   * Load state tagged with the src it belongs to — the same pattern
   * `book/page.tsx` uses for its fetched state, and for the same reason.
   *
   * Swapping the `id` in `/book?id=...` re-renders this component with a new
   * `coverId` rather than remounting it, so a plain `useState(false)` here
   * would carry the previous cover's "loaded" flag across the change. Since a
   * browser keeps showing an `<img>`'s last decoded frame until its *new* src
   * finishes loading, that stale `true` briefly displayed the outgoing cover
   * at full opacity instead of dropping back to the skeleton. Comparing `src`
   * during render invalidates it the instant the identity changes — no reset
   * effect, no window where the wrong cover is on screen.
   */
  const [state, setState] = useState<{ src?: string; status: "loading" | "loaded" | "failed" }>({
    src,
    status: "loading",
  });
  const fresh = state.src === src;
  const loaded = fresh && state.status === "loaded";
  const failed = fresh && state.status === "failed";
  const showImage = Boolean(coverId) && !failed;

  return (
    <div
      className={cn(
        "relative aspect-2/3 w-full overflow-hidden rounded-[2px]",
        "bg-paper-sunk shadow-[var(--shadow-md)]",
        // The spine: a hairline and an inner shadow down the left edge, so a
        // flat image reads as a physical object on a shelf.
        "before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-[3px]",
        "before:bg-linear-to-r before:from-black/22 before:to-transparent",
        className,
      )}
    >
      {showImage ? (
        <>
          {/*
           * A cover takes ~310ms at the median and near a second at p90 — three
           * round trips, because Open Library redirects twice into archive.org.
           * The shimmer gives the grid its structure immediately instead of
           * leaving eighty empty rectangles while they arrive.
           */}
          {!loaded && (
            <div className="absolute inset-0 animate-pulse bg-linear-to-br from-paper-sunk via-paper-raised to-paper-sunk" />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img
            src={src}
            alt={`Cover of ${title}`}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            onError={() => setState({ src, status: "failed" })}
            onLoad={() => setState({ src, status: "loaded" })}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
              loaded ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      ) : (
        <div className="flex h-full flex-col justify-between border border-rule bg-paper-sunk p-3">
          <p className="font-display text-[0.9rem] leading-[1.15] font-medium text-balance text-ink">
            {title}
          </p>
          <p className="u-meta text-ink-faint">{author}</p>
        </div>
      )}
    </div>
  );
}
