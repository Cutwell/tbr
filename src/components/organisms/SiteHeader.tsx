"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/molecules/NavLink";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";
import { AgentIndicator } from "@/components/organisms/AgentIndicator";
import { cn } from "@/lib/utils/cn";

/**
 * The masthead, set like the front page of a literary quarterly.
 *
 * The wordmark shrinks away from the shelf: at full size it anchors the home
 * page, and on every other route it steps back to let the page's own subject
 * lead. The masthead carries no data of its own — reading statistics belong on
 * the taste page, beside the profile they are evidence for.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const isShelf = pathname === "/";

  return (
    <header className="border-b border-ink/85">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div>
          <Link href="/" className="inline-block">
            <h1
              className={cn(
                "font-display leading-[0.82] font-semibold text-ink transition-[font-size] duration-300",
                isShelf
                  ? "text-[clamp(3.5rem,13vw,7.5rem)]"
                  : "text-[clamp(2rem,6vw,3rem)]",
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

      <nav aria-label="Sections" className="mt-6 flex gap-6">
        <NavLink href="/">Shelf</NavLink>
        <NavLink href="/search">Search</NavLink>
        <NavLink href="/taste">Taste</NavLink>
      </nav>
    </header>
  );
}
