"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { NavLink } from "@/components/molecules/NavLink";
import { StatFigure } from "@/components/molecules/StatFigure";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";
import { AgentIndicator } from "@/components/organisms/AgentIndicator";
import { buildTasteProfile } from "@/lib/store/profile";
import { useLibrary } from "@/lib/store/useLibrary";
import type { Shelf } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

/**
 * The masthead, set like the front page of a literary quarterly.
 *
 * The wordmark shrinks away from the shelf: at full size it anchors the home
 * page, and on every other route it steps back to let the page's own subject
 * lead. Reading statistics appear only on the shelf, where they describe what
 * is directly below them.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const books = useLibrary();
  const isShelf = pathname === "/";

  const counts = useMemo(() => {
    const tally = { tbr: 0, read: 0, dnf: 0 } as Record<Shelf, number>;
    for (const book of books) tally[book.shelf] += 1;
    return tally;
  }, [books]);

  const profile = useMemo(() => buildTasteProfile(books), [books]);

  return (
    <header className="border-b border-ink/85">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div>
          <Link href="/" className="inline-block">
            <h1
              className={cn(
                "font-display leading-[0.82] font-semibold text-ink transition-[font-size] duration-300",
                isShelf ? "text-[clamp(3.5rem,13vw,7.5rem)]" : "text-[clamp(2rem,6vw,3rem)]",
              )}
            >
              TBR
            </h1>
          </Link>
          {isShelf && (
            <p className="u-meta mt-3 text-ink-faint">
              To be read — a library your agent can read too
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 self-start pt-1">
          <ThemeToggle />
          <AgentIndicator />
        </div>
      </div>

      {/* Hidden on an empty library: a row of zeroes and em dashes above the
          first-run panel describes nothing and undercuts what it is offering. */}
      {isShelf && books.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-x-10 gap-y-5">
          <StatFigure value={counts.tbr} label="Waiting" tone="var(--shelf-tbr)" />
          <StatFigure value={counts.read} label="Finished" tone="var(--shelf-read)" />
          <StatFigure value={counts.dnf} label="Abandoned" tone="var(--shelf-dnf)" />
          <StatFigure value={profile.averageRating?.toFixed(1) ?? "—"} label="Avg rating" />
          <StatFigure
            value={profile.finishingRate === null ? "—" : `${profile.finishingRate}%`}
            label="Finish rate"
          />
        </div>
      )}

      <nav aria-label="Sections" className="mt-6 flex gap-6">
        <NavLink href="/">Shelf</NavLink>
        <NavLink href="/search">Search</NavLink>
        <NavLink href="/taste">Taste</NavLink>
      </nav>
    </header>
  );
}
