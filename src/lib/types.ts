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

export type BookPatch = Partial<Pick<Book, "shelf" | "rating" | "note">>;

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
