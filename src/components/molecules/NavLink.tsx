"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/**
 * A masthead nav link.
 *
 * The active state is an underline in the accent rather than a filled pill —
 * the whole layout is built on hairline rules, and a pill would import a
 * different shape language into the one place that sets the tone.
 */
export function NavLink({ href, children }: { href: string; children: string }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "u-meta relative py-2 transition-colors duration-150",
        active ? "text-ink" : "text-ink-faint hover:text-ink-soft",
      )}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 -bottom-px h-px origin-left transition-transform duration-200 ease-[var(--ease-out-soft)]",
          active ? "scale-x-100 bg-accent" : "scale-x-0 bg-rule-strong",
        )}
      />
    </Link>
  );
}
