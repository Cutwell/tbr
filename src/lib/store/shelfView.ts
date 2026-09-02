import type { Book, Shelf } from "@/lib/types";
import { SHELF_DATE_LABEL, shelfDate } from "@/lib/utils/shelfDate";

/**
 * How the shelf is being looked at: which shelf, which search, which order.
 *
 * This module exists because the shelf page unmounts.
 *
 * Opening a book is a route change, so `/` is torn down and rebuilt when the
 * reader comes back — and `useState` goes with it. Filtering to "read", finding
 * the book you meant, opening it and landing back on an unfiltered list is a
 * small, constant tax on the only navigation loop this app has.
 *
 * The fix is to keep the view outside React, in the same spirit as
 * `navigation.ts`: a module singleton, read once into `useState` when the page
 * mounts and written through on every change. No subscription, because nothing
 * needs to *react* to it — the page that owns the state is the only reader, and
 * it already re-renders itself.
 *
 * It is memory rather than storage on purpose. A reload is the reader saying
 * "start again", and it lands them on the default view below.
 */

export const SORTS = ["recent", "title", "date"] as const;

export type SortKey = (typeof SORTS)[number];

export interface ShelfView {
  shelf: Shelf | null;
  search: string;
  sort: SortKey;
  /**
   * Whether this session has settled which shelf it opens on.
   *
   * The opening shelf cannot be decided when the page first renders. The
   * library hydrates on mount, so at that moment every shelf is empty and the
   * question "does the reader have anything to read?" has no honest answer yet.
   * It gets decided on the first render where the library is actually known,
   * and this records that it has been — because it must happen exactly once.
   *
   * Once is the whole point. A reader who deliberately opens an empty TBR
   * shelf, then opens a book and comes back, must land back on the empty TBR
   * shelf. Re-deciding on that second mount would bounce them to All and quietly
   * throw away the choice this module exists to preserve.
   */
  settled: boolean;
}

/**
 * Where a fresh visit starts: the to-read shelf, newest first.
 *
 * Not "All". The question this app is for is "what should I read next?", and
 * the answer is never on the read shelf. Every other shelf is one click away,
 * and once clicked it is what the reader comes back to.
 *
 * With one exception, applied by `openingShelf` below: a reader whose TBR shelf
 * is empty. Opening them on "That shelf is empty" hides a library they can see
 * the counts for, and answers their question with a blank page.
 */
export const DEFAULT_VIEW: ShelfView = {
  shelf: "tbr",
  search: "",
  sort: "recent",
  settled: false,
};

/**
 * The shelf to open on, given what is actually on the shelves.
 *
 * Falls back to All only from the default — never from a shelf that was picked,
 * by the reader or by an agent's `navigate_to`. Both are answered by reading the
 * remembered shelf rather than the caller's own state, which is also what makes
 * this safe to call in the same render pass as a pending navigation: that
 * command has already written its shelf here, so this sees a chosen shelf and
 * leaves it alone.
 */
export function openingShelf(tbrCount: number): Shelf | null {
  if (view.shelf !== DEFAULT_VIEW.shelf) return view.shelf;
  return tbrCount === 0 ? null : view.shelf;
}

let view: ShelfView = DEFAULT_VIEW;

export function getShelfView(): ShelfView {
  return view;
}

/** Records a change so the next mount of the shelf page starts where this left off. */
export function rememberShelfView(patch: Partial<ShelfView>): void {
  view = { ...view, ...patch };
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * A collator rather than `<`, because `localeCompare` on raw strings sorts
 * "Zoo" before "ánimo" and treats "Book 2" as later than "Book 10".
 */
const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/**
 * Leading articles are dropped for sorting, the way a library catalogue does
 * it: "The Dispossessed" files under D. A shelf where a third of the titles
 * pile up under T is alphabetical in name only.
 */
const LEADING_ARTICLE = /^(?:the|a|an)\s+/i;

function fileUnder(title: string): string {
  return title.replace(LEADING_ARTICLE, "");
}

/** The label a sort wears, which for dates depends on the shelf being shown. */
export function sortLabel(sort: SortKey, shelf: Shelf | null): string {
  if (sort === "recent") return "Recent";
  if (sort === "title") return "A–Z";
  // On a single shelf the date has a name — "Finished", "Added". Across all
  // three it is a different date per book, so it only gets to be "Date".
  return shelf ? SHELF_DATE_LABEL[shelf] : "Date";
}

/**
 * Arranges a filtered list.
 *
 * `recent` returns the input untouched, which is not laziness: the store keeps
 * newest-first insertion order and holds a book's position steady when it is
 * edited. Sorting by `updatedAt` instead would make a card leap to the front of
 * the grid the moment you rated it — the one thing you must not do to someone
 * working down a list.
 */
export function orderBooks(books: readonly Book[], sort: SortKey): readonly Book[] {
  if (sort === "recent") return books;

  if (sort === "title") {
    return [...books].sort(
      (a, b) =>
        collator.compare(fileUnder(a.title), fileUnder(b.title)) ||
        collator.compare(a.author, b.author),
    );
  }

  return [...books].sort((a, b) => {
    const left = shelfDate(a).iso;
    const right = shelfDate(b).iso;

    // Undated books sink rather than clustering at the top, where they would
    // read as "most recent". A `read` book can genuinely have no finish date:
    // a Goodreads row without a Date Read, or one the reader cleared.
    if (!left) return right ? 1 : collator.compare(fileUnder(a.title), fileUnder(b.title));
    if (!right) return -1;

    // Both are `YYYY-MM-DD`, so a string compare is a date compare.
    return right.localeCompare(left) || collator.compare(fileUnder(a.title), fileUnder(b.title));
  });
}
