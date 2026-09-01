import { PersistentCache } from "@/lib/catalog/cache";
import type { CatalogResult } from "@/lib/types";

/**
 * Open Library catalogue client.
 *
 * Chosen over Google Books because it needs no API key and serves
 * `access-control-allow-origin: *` on both search and cover images — so TBR
 * runs entirely client-side with no backend and no proxy. (An unauthenticated
 * Google Books request returns HTTP 429 on the first try, which would force a
 * keyed proxy, which would force a server.)
 */

const SEARCH_ENDPOINT = "https://openlibrary.org/search.json";
const COVER_ENDPOINT = "https://covers.openlibrary.org/b/id";

/**
 * Always request an explicit field projection. Without it, a two-book response
 * is 2,838 bytes — almost entirely a 100-element ISBN array we never use.
 */
const FIELDS = ["key", "title", "author_name", "first_publish_year", "cover_i"].join(",");

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}

export type CoverSize = "S" | "M" | "L";

export function coverUrl(coverId: number, size: CoverSize = "M"): string {
  return `${COVER_ENDPOINT}/${coverId}-${size}.jpg`;
}

/** "/works/OL59863W" → "OL59863W" */
function shortKey(key: string): string {
  return key.replace(/^\/works\//, "");
}

/**
 * Search results, cached across reloads.
 *
 * Open Library sends no cache headers on `search.json`, so without this every
 * reload refetches. A week is safe: book metadata does not move, and a stale
 * title is harmless. Being frugal also matters — Open Library is a
 * donation-funded nonprofit and both agents and humans retype the same query.
 */
const searchCache = new PersistentCache<CatalogResult[]>({
  name: "search",
  ttl: 7 * 24 * 60 * 60 * 1000,
  max: 120,
});

export async function searchCatalog(
  query: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<CatalogResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${trimmed.toLowerCase()}::${limit}`;
  const hit = searchCache.get(cacheKey);
  if (hit) return hit;

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("fields", FIELDS);

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Open Library returned ${response.status}`);
  }

  const payload: { docs?: OpenLibraryDoc[] } = await response.json();

  const results = (payload.docs ?? [])
    .filter((doc): doc is OpenLibraryDoc & { key: string; title: string } =>
      Boolean(doc.key && doc.title),
    )
    .map<CatalogResult>((doc) => ({
      olKey: shortKey(doc.key),
      title: doc.title,
      author: doc.author_name?.[0] ?? "Unknown",
      year: doc.first_publish_year,
      coverId: doc.cover_i,
    }));

  searchCache.set(cacheKey, results);
  return results;
}

// ---------------------------------------------------------------------------
// Work detail — for the book page only
// ---------------------------------------------------------------------------

/**
 * Everything the detail page needs, none of which belongs on a shelf card.
 *
 * These fields are deliberately absent from the `Book` record: they would cost
 * output budget on every WebMCP tool call that lists books, and no agent needs
 * a synopsis to decide what to recommend. A reader choosing what to pick up
 * tonight very much does, so they are fetched on demand instead.
 */
export interface WorkDetail {
  description?: string;
  subjects: string[];
  firstPublished?: string;
}

interface OpenLibraryWork {
  description?: string | { value?: string };
  subjects?: string[];
  first_publish_date?: string;
}

const workCache = new PersistentCache<WorkDetail>({
  name: "work",
  ttl: 30 * 24 * 60 * 60 * 1000,
  max: 200,
});

/**
 * Subjects worth showing a reader.
 *
 * Open Library mixes three things into one list: real subjects, translated
 * duplicates of them ("Anarchism", "Anarquismo", "Ciencia-ficcion"), and
 * machine-facing namespaced tags ("form:novel", "genre:fantasy"). Diacritics
 * identify the second; a colon prefix identifies the third.
 */
function isReadableSubject(subject: string): boolean {
  if (/[^\u0000-\u007F]/.test(subject)) return false;
  if (/^[a-z_]+:/.test(subject)) return false;
  return true;
}


/**
 * Open Library descriptions are contributor-written Markdown, not plain prose.
 *
 * They routinely carry bold and italic markers, reference-style links, a
 * horizontal rule, and a trailing provenance line — all of which render as
 * literal punctuation in a synopsis. This reduces them to the prose, which is
 * the only part a reader wants.
 */
function cleanDescription(raw: string): string {
  return (
    raw
      // Everything after a horizontal rule is provenance, not synopsis.
      .split(/\n\s*-{3,}\s*\n/)[0]
      // Markdown links and reference definitions.
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
      .replace(/^\s*\[[^\]]+\]:.*$/gm, "")
      // Emphasis markers, left as literal asterisks otherwise.
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      .replace(/(^|\s)_([^_]+)_(?=\s|$)/g, "$1$2")
      // The provenance sentence, with or without a preceding rule.
      .replace(/\s*\(?(?:This description|Description) (?:comes|is) from[^.]*\.?\)?\s*$/i, "")
      .replace(/\s*--\s*from[^.\n]*\.?\s*$/i, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Fetches synopsis and subjects for a work.
 *
 * `description` arrives as either a bare string or `{ value }` depending on the
 * age of the record, so both are handled. Subjects come back with translated
 * duplicates interleaved — "Anarchism", "Anarquismo", "Ciencia-ficcion" — which
 * are filtered out and de-duplicated.
 */
export async function fetchWorkDetail(
  olKey: string,
  signal?: AbortSignal,
): Promise<WorkDetail> {
  const cached = workCache.get(olKey);
  if (cached) return cached;

  const response = await fetch(`https://openlibrary.org/works/${olKey}.json`, { signal });
  if (!response.ok) throw new Error(`Open Library returned ${response.status}`);

  const work: OpenLibraryWork = await response.json();

  const raw = work.description;
  const described = typeof raw === "string" ? raw : raw?.value;

  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const subject of work.subjects ?? []) {
    const key = subject.toLowerCase();
    if (!isReadableSubject(subject) || seen.has(key)) continue;
    seen.add(key);
    subjects.push(subject);
    if (subjects.length === 8) break;
  }

  const detail: WorkDetail = {
    description: described ? cleanDescription(described) : undefined,
    subjects,
    firstPublished: work.first_publish_date,
  };

  workCache.set(olKey, detail);
  return detail;
}

/**
 * Resolves an Open Library work key to a full record.
 *
 * The key must be passed through the search index's `key:` field — putting the
 * bare key in `q` returns *zero* results, which is a quiet and expensive trap:
 * a caller that treats "no match" as "use what I was given" ends up creating a
 * book titled "OL3511459W".
 *
 * The works endpoint (`/works/{key}.json`) also has the title, but its authors
 * are unresolved references needing a second request each, whereas this returns
 * title, author, year and cover in one.
 */
export async function lookupByKey(
  olKey: string,
  signal?: AbortSignal,
): Promise<CatalogResult | null> {
  const results = await searchCatalog(`key:/works/${olKey}`, 1, signal);
  const [match] = results;
  return match?.olKey === olKey ? match : null;
}
