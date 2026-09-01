import type { Book, BookPatch, LibraryQuery, NewBook, Shelf } from "@/lib/types";
import { SHELVES } from "@/lib/types";
import { buildTasteProfile } from "@/lib/store/profile";
import { today } from "@/lib/utils/date";
import { seedLibrary } from "@/lib/store/seed";

/**
 * The library store — the single source of truth for every book in TBR.
 *
 * ARCHITECTURAL RULE, and the most important one in this codebase:
 *
 *   WebMCP tools must never touch localStorage or React state directly.
 *   They go through this module, exactly as the UI does.
 *
 * If a tool wrote around the store, an agent's changes would not appear until
 * the page reloaded — and the entire visual payoff of this app is watching
 * books land on the shelf as the agent works. One store, one set of
 * subscribers, and the UI re-renders no matter who did the writing.
 *
 * Shaped for `useSyncExternalStore`: `getSnapshot` returns a stable reference
 * that only changes identity when the data actually changes.
 */

const STORAGE_KEY = "tbr.library.v1";

/** Stable empty references — a fresh value each call would loop useSyncExternalStore. */
const EMPTY: readonly Book[] = Object.freeze([]);
const NO_IDS: ReadonlySet<string> = new Set();

/** How long a freshly-changed book stays highlighted in the UI. */
const HIGHLIGHT_MS = 4_000;

type Listener = () => void;

let books: readonly Book[] = EMPTY;
let touched: ReadonlySet<string> = NO_IDS;
let touchTimer: ReturnType<typeof setTimeout> | undefined;
let hydrated = false;
const listeners = new Set<Listener>();

/**
 * Marks books as just-changed, so the UI can highlight them.
 *
 * This lives in the store rather than in a React hook for two reasons. It keeps
 * the clock out of render — reading `Date.now()` while rendering is impure, and
 * React 19 rightly rejects it. And it means an agent's writes light up through
 * exactly the same path as a person's, with no component needing to know which
 * it was.
 */
function markTouched(ids: string[]): void {
  touched = new Set(ids);
  clearTimeout(touchTimer);
  touchTimer = setTimeout(() => {
    touched = NO_IDS;
    emit();
  }, HIGHLIGHT_MS);
}

function emit(): void {
  for (const listener of listeners) listener();
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    // Private browsing, quota, or disabled storage. The in-memory library still
    // works for this session; losing persistence is better than losing the app.
  }
}

function commit(next: readonly Book[]): void {
  books = Object.freeze(next);
  persist();
  emit();
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b_${Math.random().toString(36).slice(2, 10)}`;
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

/** Two books match if they share an Open Library key, or title *and* author. */
function isSameBook(book: Book, candidate: { olKey?: string; title: string; author: string }) {
  if (book.olKey && candidate.olKey) return book.olKey === candidate.olKey;
  return (
    normalise(book.title) === normalise(candidate.title) &&
    normalise(book.author) === normalise(candidate.author)
  );
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): readonly Book[] {
  return books;
}

function getTouched(): ReadonlySet<string> {
  return touched;
}

function getNoTouched(): ReadonlySet<string> {
  return NO_IDS;
}

/** The server renders an empty library; the client hydrates on mount. */
function getServerSnapshot(): readonly Book[] {
  return EMPTY;
}

function all(): readonly Book[] {
  return books;
}

function get(id: string): Book | undefined {
  return books.find((book) => book.id === id);
}

function counts(): Record<Shelf, number> {
  const tally = { tbr: 0, read: 0, dnf: 0 } as Record<Shelf, number>;
  for (const book of books) tally[book.shelf] += 1;
  return tally;
}

/**
 * Filtered query. Returns `total` alongside the page so callers can say what
 * they withheld — an agent handed a silently truncated list becomes
 * confidently wrong.
 */
function query({ shelf, text, minRating, limit }: LibraryQuery = {}): {
  results: Book[];
  total: number;
} {
  const needle = text ? normalise(text) : null;

  const matched = books.filter((book) => {
    if (shelf && book.shelf !== shelf) return false;
    if (minRating && (book.rating ?? 0) < minRating) return false;
    if (needle) {
      const haystack = `${book.title} ${book.author}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const ordered = [...matched].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    results: typeof limit === "number" ? ordered.slice(0, limit) : ordered,
    total: ordered.length,
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Adds a book. A duplicate is reported, never thrown: the photograph-a-shelf
 * journey re-adds books routinely, and an error there derails the agent.
 */
function add(input: NewBook): { book: Book; duplicate: boolean } {
  const existing = books.find((book) => isSameBook(book, input));
  if (existing) return { book: existing, duplicate: true };

  const timestamp = nowIso();
  const shelf = input.shelf ?? "tbr";
  const book: Book = {
    ...input,
    id: createId(),
    shelf,
    // "I just finished this, add it" arrives here as a direct add to `read`,
    // never as a move, so the stamp has to happen on this path too. An
    // explicit date on the input still wins — that is what lets the CSV
    // importer supply Goodreads' own Date Read.
    endedAt: input.endedAt ?? (shelf === "tbr" ? undefined : today()),
    addedAt: timestamp,
    updatedAt: timestamp,
  };

  markTouched([book.id]);
  commit([book, ...books]);
  return { book, duplicate: false };
}

/** Applies a patch. Undefined fields are left untouched, never nulled. */
function update(id: string, patch: BookPatch): Book | null {
  const current = get(id);
  if (!current) return null;

  const next: Book = { ...current, updatedAt: nowIso() };
  if (patch.shelf !== undefined) next.shelf = patch.shelf;
  if (patch.rating !== undefined) next.rating = patch.rating;
  if (patch.note !== undefined) next.note = patch.note;

  /*
   * Stamp the end date, but only on a deliberate shelf move.
   *
   * The gate is `patch.shelf !== undefined` rather than "the book is now on
   * read". Rating a book you finished last year is an update to a `read` book,
   * and it must not silently restamp the date to today — that is the whole
   * failure this condition exists to prevent.
   *
   * Within a shelf move: leaving for `tbr` clears the date, because a book you
   * intend to read has not ended. Arriving from `tbr` sets today. Moving
   * between `read` and `dnf` keeps whatever date is already there, since the
   * book ended once and only the verdict changed — unless there is no date at
   * all, in which case there is nothing to preserve.
   */
  if (patch.shelf !== undefined) {
    if (patch.shelf === "tbr") next.endedAt = undefined;
    else if (current.shelf === "tbr" || !current.endedAt) next.endedAt = today();
  }

  // An explicit date always wins over the automatic stamp above; `null` is the
  // caller saying "clear it", which `undefined` cannot express.
  if (patch.endedAt !== undefined) {
    next.endedAt = patch.endedAt === null ? undefined : patch.endedAt;
  }

  markTouched([id]);
  commit(books.map((book) => (book.id === id ? next : book)));
  return next;
}

function remove(id: string): Book | null {
  const target = get(id);
  if (!target) return null;
  commit(books.filter((book) => book.id !== id));
  return target;
}

/** Re-inserts a removed book at its original position-ish. Powers undo. */
function restore(book: Book): void {
  if (get(book.id)) return;
  markTouched([book.id]);
  commit([book, ...books]);
}

/** Bulk insert used by CSV import. Returns per-row outcomes for the summary. */
function addMany(inputs: NewBook[]): { added: number; duplicates: number } {
  let added = 0;
  let duplicates = 0;
  const timestamp = nowIso();
  const next = [...books];

  for (const input of inputs) {
    if (next.some((book) => isSameBook(book, input))) {
      duplicates += 1;
      continue;
    }
    const shelf = input.shelf ?? "tbr";
    next.unshift({
      ...input,
      id: createId(),
      shelf,
      // A Goodreads export carries its own Date Read, and using it matters:
      // stamping today on a 200-book import would claim the reader finished
      // every one of them this afternoon. Today is only the fallback.
      endedAt: input.endedAt ?? (shelf === "tbr" ? undefined : today()),
      addedAt: timestamp,
      updatedAt: timestamp,
    });
    added += 1;
  }

  if (added > 0) {
    markTouched(next.slice(0, added).map((book) => book.id));
    commit(next);
  }
  return { added, duplicates };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Loads whatever the reader already has. Nothing is seeded.
 *
 * TBR used to plant the 80-book demo library on first visit, on the reasoning
 * that an empty library is a broken demo (docs/07-risks.md, R2). That solved
 * the right problem the wrong way: it presumed consent to fill someone's
 * reading list with books they had never read, and it hid the fact that the
 * shelf is genuinely theirs. The first-run panel now does that job explicitly,
 * offering the demo as one of four ways in rather than choosing for them.
 */
function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      // An empty array is now a real, respected state: a reader who cleared
      // their list, or one who has not begun. Both mean "show the first-run
      // panel", and neither means "plant 80 books they did not ask for".
      if (Array.isArray(parsed)) {
        books = Object.freeze(parsed as Book[]);
        emit();
        return;
      }
    }
  } catch {
    // Corrupt payload — start empty rather than rendering a broken shelf.
  }

  emit();
}

/**
 * Replaces the library with the curated demo set. Returns how many landed.
 *
 * No `markTouched` here, unlike every other bulk write: highlighting a dozen
 * arbitrary books out of eighty says nothing. The grid arriving at once is
 * already the visible event.
 */
function loadDemo(): number {
  const demo = seedLibrary();
  commit(demo);
  return demo.length;
}

/** Back to the first-run state: an empty shelf and the panel that explains it. */
function reset(): void {
  commit([]);
}

function profile() {
  return buildTasteProfile(books);
}

/**
 * Highlights books without changing them.
 *
 * `add`/`update`/`restore` all call `markTouched` as part of a write, piggy-
 * backing on that write's own `emit()`. This is the read-only counterpart —
 * the navigate tool uses it to point at a book nothing just wrote to, e.g. one
 * surfaced by `search_my_books` — so it has to emit for itself.
 */
function touch(ids: string[]): void {
  markTouched(ids);
  emit();
}

/**
 * The console escape hatch, for readers who want their shelf back to nothing.
 *
 * Deliberately the console rather than a button. A control that erases a
 * reading list does not belong in a reading list, and one sitting beside a
 * loaded demo library is a mis-click away from destroying the thing being
 * demonstrated (docs/05-architecture.md). Everything lives in localStorage, so
 * the data is the reader's outright; what was missing was a way to say "start
 * over" without opening devtools' storage inspector.
 *
 * Unlike `__tbrTools`, this ships in production. That is the point of it.
 */
function exposeConsoleApi(): void {
  if (typeof window === "undefined") return;

  const api = window as unknown as Record<string, unknown>;
  api.resetList = () => {
    reset();
    return "Your list is empty. Reload not needed.";
  };
  api.loadDemo = () => `Loaded ${loadDemo()} demo books.`;

  console.info(
    "%cTBR%c  resetList() empties your shelf · loadDemo() loads the example library",
    "font-weight:700",
    "color:inherit",
  );
}

export const library = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  getTouched,
  getNoTouched,
  hydrate,
  exposeConsoleApi,
  loadDemo,
  reset,
  all,
  get,
  counts,
  query,
  add,
  addMany,
  update,
  remove,
  restore,
  touch,
  profile,
};

export { SHELVES };
