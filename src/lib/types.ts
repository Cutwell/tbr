/**
 * Core domain types.
 *
 * The `Book` record is deliberately small. Every field here eventually crosses
 * into an agent's context through a WebMCP tool, where the output budget is
 * 1,500 characters — so fields must earn their place. Notably absent:
 *
 *   - `isbn`     Open Library returns ~100 per work. Enormous cost, no use.
 *   - `subjects` Noisy and long; taste signal is derived from authors instead.
 *   - `series`   Inconsistently exposed by Open Library. Full-text catalogue
 *                search still matches series names, so the capability survives
 *                without the storage.
 */

export const SHELVES = ["tbr", "read", "dnf"] as const;

export type Shelf = (typeof SHELVES)[number];

export type Rating = 1 | 2 | 3 | 4 | 5;

export const RATINGS = [1, 2, 3, 4, 5] as const;

/** Narrows a loose number — a parsed CSV cell, a model's tool argument — to a
 *  `Rating`, or `undefined` when it is out of range. Never throws. */
export function asRating(value: number | undefined): Rating | undefined {
  return RATINGS.find((rating) => rating === value);
}

export interface Book {
  id: string;
  title: string;
  /** Primary author only. Open Library returns an array; we take the first. */
  author: string;
  /** First publication year, per Open Library. */
  year?: number;
  /** Open Library cover id → covers.openlibrary.org/b/id/{coverId}-M.jpg */
  coverId?: number;
  /** Open Library work key, e.g. "OL59863W". Doubles as the dedupe key. */
  olKey?: string;
  shelf: Shelf;
  rating?: Rating;
  /** Free text: why it is on the list. */
  note?: string;
  /**
   * The day the book stopped being read — finished, or given up on.
   *
   * One field for both, because it records the same event either way and the
   * shelf already says which it was: the UI reads it as "Finished" on `read`
   * and "Gave up" on `dnf`. Absent on `tbr`, and cleared when a book moves
   * back there — a book you intend to read has not ended.
   *
   * A plain `YYYY-MM-DD` calendar date, deliberately *not* an ISO instant like
   * `addedAt` and `updatedAt`. Those record when the software did something;
   * this records a day a person picked. Storing it as a timestamp would mean
   * "12 March" chosen in UTC+13 comes back as 11 March once it is normalised
   * through UTC, and there is no hour of the day worth keeping to justify the
   * risk. It is also exactly what `<input type="date">` reads and writes, and
   * what Goodreads exports.
   */
  endedAt?: string;
  addedAt: string;
  updatedAt: string;
}

/** A catalogue search result — not yet a book on any shelf. */
export interface CatalogResult {
  olKey: string;
  title: string;
  author: string;
  year?: number;
  coverId?: number;
}

export interface LibraryQuery {
  shelf?: Shelf;
  text?: string;
  minRating?: Rating;
  limit?: number;
}

export type NewBook = Omit<Book, "id" | "addedAt" | "updatedAt" | "shelf"> & {
  shelf?: Shelf;
};

/**
 * A partial update. `undefined` means "leave alone" throughout.
 *
 * `endedAt` additionally accepts `null`, meaning "clear it" — the one field a
 * caller needs to be able to unset deliberately, since `undefined` is already
 * spoken for. Passing it at all overrides the automatic stamping in
 * `store.update`.
 */
export type BookPatch = Partial<Pick<Book, "shelf" | "rating" | "note">> & {
  endedAt?: string | null;
};

/**
 * Aggregated reading taste, computed on the site rather than by the agent.
 *
 * This is the heart of the WebMCP integration: an agent cannot page through a
 * 60-book history inside a 1,500-character budget, but it can reason
 * beautifully from a summary this size.
 */
export interface AuthorAffinity {
  author: string;
  /** Books by this author on the read or dnf shelves. */
  count: number;
  /** Mean of this author's ratings, or 0 when none are rated. */
  averageRating: number;
  /** How many were abandoned — the strongest negative signal a reader gives. */
  abandoned: number;
}

export interface TasteProfile {
  counts: Record<Shelf, number>;
  totalRated: number;
  averageRating: number | null;
  loved: AuthorAffinity[];
  disliked: AuthorAffinity[];
  eras: { decade: number; share: number }[];
  finishingRate: number | null;
  recentlyFinished: Pick<Book, "title" | "rating">[];
  /** A deterministic, heuristic one-liner. No model involved. */
  signal: string | null;
  /** True when there is too little history to say anything honest. */
  sparse: boolean;
}
