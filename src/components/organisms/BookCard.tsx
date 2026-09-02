"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { IconButton } from "@/components/atoms/IconButton";
import { BookCover } from "@/components/molecules/BookCover";
import { SHELF_SHORT } from "@/components/molecules/ShelfBadge";
import { StarRating } from "@/components/molecules/StarRating";
import { SHELVES, type Book, type Rating, type Shelf } from "@/lib/types";
import { cn } from "@/lib/utils/cn";
import { shelfDate } from "@/lib/utils/shelfDate";

interface BookCardProps {
  book: Book;
  /** Pulses the card — used when a book was just changed, by anyone. */
  highlighted?: boolean;
  /** Staggers the entrance animation across a grid. */
  index?: number;
  priority?: boolean;
  onSetShelf: (id: string, shelf: Shelf) => void;
  onRate: (id: string, rating: Rating | undefined) => void;
  onRemove: (id: string) => void;
}

const SHELF_TONE: Record<Shelf, string> = {
  tbr: "hover:border-shelf-tbr hover:text-shelf-tbr",
  read: "hover:border-shelf-read hover:text-shelf-read",
  dnf: "hover:border-shelf-dnf hover:text-shelf-dnf",
};

/**
 * One book on the shelf.
 *
 * Shelf controls live in an overlay on the cover rather than beneath the title,
 * which keeps every card in the grid the same height regardless of how much
 * metadata a book has. The overlay is revealed by `group-hover` *and*
 * `focus-within`, so the card is fully operable from the keyboard.
 *
 * The cover and title link through to the book's page. Note that the overlay is
 * a *sibling* of that link rather than a child: nesting buttons inside an
 * anchor is invalid markup and breaks both click handling and screen readers.
 */
export function BookCard({
  book,
  highlighted = false,
  index = 0,
  priority = false,
  onSetShelf,
  onRate,
  onRemove,
}: BookCardProps) {
  const articleRef = useRef<HTMLElement>(null);

  // Which date a card shows follows its shelf: how long it has been waiting, or
  // the day it was closed. See shelfDate.ts.
  const dated = shelfDate(book);

  // Scrolls a book into view the moment it is highlighted — the pulse means
  // nothing if the card it is on is off-screen, which is exactly the case a
  // cross-page `navigate_to` highlight produces.
  useEffect(() => {
    if (highlighted) articleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  return (
    <article
      ref={articleRef}
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
      className="group animate-rise focus-within:relative focus-within:z-10"
    >
      <div
        className={cn(
          "relative transition-transform duration-300 ease-[var(--ease-out-soft)]",
          "group-hover:-translate-y-1 group-focus-within:-translate-y-1",
          highlighted && "animate-pulse-once rounded-[2px]",
        )}
      >
        <Link href={`/book?id=${book.id}`} className="block" tabIndex={-1} aria-hidden="true">
          <BookCover
            title={book.title}
            author={book.author}
            coverId={book.coverId}
            priority={priority}
          />
        </Link>

        {/* Shelf controls. Hidden until hover or keyboard focus. */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-1",
            "border-t border-white/10 bg-paper-raised/94 px-1.5 py-1.5 backdrop-blur-sm",
            "translate-y-full opacity-0 transition-[transform,opacity] duration-200 ease-[var(--ease-out-soft)]",
            "group-hover:translate-y-0 group-hover:opacity-100",
            "group-focus-within:translate-y-0 group-focus-within:opacity-100",
          )}
        >
          <div className="flex gap-1">
            {SHELVES.map((shelf) => (
              <button
                key={shelf}
                type="button"
                onClick={() => onSetShelf(book.id, shelf)}
                aria-pressed={book.shelf === shelf}
                title={`Move to ${SHELF_SHORT[shelf]}`}
                className={cn(
                  "u-meta rounded-[2px] border px-1.5 py-1 transition-colors duration-150",
                  book.shelf === shelf
                    ? "border-ink bg-ink text-paper"
                    : cn("border-rule text-ink-soft", SHELF_TONE[shelf]),
                )}
              >
                {SHELF_SHORT[shelf]}
              </button>
            ))}
          </div>
          <IconButton
            icon="trash"
            label={`Remove ${book.title}`}
            size={14}
            onClick={() => onRemove(book.id)}
            className="h-7 w-7 hover:text-accent"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <h3 className="font-display text-[0.95rem] leading-tight font-medium text-balance">
          <Link
            href={`/book?id=${book.id}`}
            className="text-ink transition-colors duration-150 hover:text-accent"
          >
            {book.title}
          </Link>
        </h3>
        <p className="text-[0.8125rem] leading-tight text-ink-soft">{book.author}</p>

        {/* Fixed-height metadata row so cards stay aligned whether or not a
            book carries a rating. */}
        <div className="mt-0.5 flex h-5 items-center justify-between gap-2">
          <span className="u-meta u-tnum text-ink-faint">{book.year ?? "—"}</span>
          <StarRating
            value={book.rating}
            onChange={(rating) => onRate(book.id, rating)}
            className={cn(
              "transition-opacity duration-200",
              book.rating
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-60 group-focus-within:opacity-100",
            )}
          />
        </div>

        {/* Kept at a fixed height and rendered even when empty, for the same
            reason as the row above: a `read` book can lack a finish date — an
            import without one, or one the reader cleared — and a grid of cards
            at two different heights is worse than a blank line. */}
        <p className="u-meta u-tnum h-4 text-ink-faint">
          {dated.formatted && `${dated.label} ${dated.formatted}`}
        </p>
      </div>
    </article>
  );
}
