import type { Book, Shelf } from "@/lib/types";
import { formatDate, toIsoDate } from "@/lib/utils/date";

/**
 * The one date that matters for a book, which depends on which shelf it is on.
 *
 * A reading list keeps three different clocks and only ever shows one of them:
 *
 *   tbr   when you added it     — how long it has been waiting
 *   read  when you finished it  — when you closed it
 *   dnf   when you gave up      — when you closed it
 *
 * They come from two different fields, and deliberately so. `endedAt` is a
 * calendar day the *reader* chose, editable on the book page. `addedAt` is an
 * ISO instant the *software* recorded and nobody picks — there is no honest way
 * to edit "when this record was created", so it is rendered and never offered.
 *
 * Converting that instant to a day is the one place the two representations
 * meet, and it is done with local components (see `date.ts`): a book added at
 * 9pm on the 12th in UTC-5 was added on the 12th, not the 13th.
 */

export const SHELF_DATE_LABEL: Record<Shelf, string> = {
  tbr: "Added",
  read: "Finished",
  dnf: "Gave up",
};

export interface ShelfDate {
  /** "Added", "Finished" or "Gave up" — always present, even with no date. */
  label: string;
  /** `YYYY-MM-DD`, or undefined when this book carries no date for its shelf. */
  iso?: string;
  /** "12 Mar 2026", or null when there is nothing to show. */
  formatted: string | null;
}

/** An ISO instant to the calendar day it happened on, locally. */
function dayOf(instant: string): string | undefined {
  const date = new Date(instant);
  // A hand-edited store or a bad import can carry nonsense here. Better to show
  // no date than "Invalid Date".
  return Number.isNaN(date.getTime()) ? undefined : toIsoDate(date);
}

export function shelfDate(book: Book): ShelfDate {
  const iso = book.shelf === "tbr" ? dayOf(book.addedAt) : book.endedAt;
  return { label: SHELF_DATE_LABEL[book.shelf], iso, formatted: formatDate(iso) };
}
