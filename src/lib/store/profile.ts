import type { AuthorAffinity, Book, Shelf, TasteProfile } from "@/lib/types";

/**
 * Taste profile aggregation.
 *
 * This is the argument for WebMCP over a screen-scraping agent. A WebMCP tool
 * may return 1,500 characters; a 60-book reading history with ratings does not
 * fit, and paging through it burns the agent's context on data it should never
 * have had to parse.
 *
 * So the site does the work. Everything below is deterministic — counting,
 * averaging and thresholding. No model is involved, including in `signal`.
 */

/** Below this, any claim about taste would be invention rather than inference. */
const SPARSE_THRESHOLD = 6;

/** An author needs this many rated books before they count as a preference. */
const MIN_BOOKS_FOR_AFFINITY = 2;

const LOVED_AT_LEAST = 4;
const DISLIKED_AT_MOST = 2.5;

/** Books published before this read as "older" for the era heuristic. */
const MODERN_FROM = 2000;

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

interface AuthorBucket {
  ratings: number[];
  total: number;
  dnf: number;
}

function bucketByAuthor(books: readonly Book[]): Map<string, AuthorBucket> {
  const buckets = new Map<string, AuthorBucket>();

  for (const book of books) {
    if (book.shelf === "tbr") continue; // Unread books say nothing about taste.

    const bucket = buckets.get(book.author) ?? { ratings: [], total: 0, dnf: 0 };
    bucket.total += 1;
    if (book.shelf === "dnf") bucket.dnf += 1;
    if (book.rating) bucket.ratings.push(book.rating);
    buckets.set(book.author, bucket);
  }

  return buckets;
}

function toAffinity(author: string, bucket: AuthorBucket): AuthorAffinity {
  return {
    author,
    count: bucket.total,
    averageRating: bucket.ratings.length ? round(mean(bucket.ratings)) : 0,
    abandoned: bucket.dnf,
  };
}

function rankLoved(buckets: Map<string, AuthorBucket>): AuthorAffinity[] {
  return [...buckets.entries()]
    .filter(([, bucket]) => {
      if (bucket.ratings.length < MIN_BOOKS_FOR_AFFINITY) return false;
      return mean(bucket.ratings) >= LOVED_AT_LEAST;
    })
    .map(([author, bucket]) => toAffinity(author, bucket))
    .sort((a, b) => b.averageRating - a.averageRating || b.count - a.count)
    .slice(0, 4);
}

/**
 * Dislike is signalled two ways: low ratings, or abandonment. A book put down
 * unrated is one of the strongest negative signals a reader produces, so DNFs
 * count even without a rating.
 */
function rankDisliked(buckets: Map<string, AuthorBucket>): AuthorAffinity[] {
  return [...buckets.entries()]
    .filter(([, bucket]) => {
      if (bucket.dnf > 0) return true;
      if (bucket.ratings.length < MIN_BOOKS_FOR_AFFINITY) return false;
      return mean(bucket.ratings) <= DISLIKED_AT_MOST;
    })
    .map(([author, bucket]) => toAffinity(author, bucket))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function eraShares(books: readonly Book[]): { decade: number; share: number }[] {
  const dated = books.filter((book) => typeof book.year === "number");
  if (dated.length === 0) return [];

  const tally = new Map<number, number>();
  for (const book of dated) {
    const decade = Math.floor(book.year! / 10) * 10;
    tally.set(decade, (tally.get(decade) ?? 0) + 1);
  }

  return [...tally.entries()]
    .map(([decade, count]) => ({ decade, share: Math.round((count / dated.length) * 100) }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 3);
}

/**
 * A single heuristic sentence, so the agent starts from a hypothesis rather
 * than a table of counts. Each clause is only emitted when the evidence
 * genuinely supports it — an overconfident profile is worse than a short one.
 */
function deriveSignal(books: readonly Book[], disliked: AuthorAffinity[]): string | null {
  const clauses: string[] = [];
  const rated = books.filter((book) => book.rating);

  const older = rated.filter((book) => (book.year ?? MODERN_FROM) < MODERN_FROM);
  const modern = rated.filter((book) => (book.year ?? MODERN_FROM) >= MODERN_FROM);

  if (older.length >= 3 && modern.length >= 3) {
    const olderMean = mean(older.map((book) => book.rating!));
    const modernMean = mean(modern.map((book) => book.rating!));
    const gap = olderMean - modernMean;
    if (gap >= 0.5) clauses.push("rates older work well above contemporary");
    else if (gap <= -0.5) clauses.push("rates contemporary work well above older");
  }

  const abandoned = books.filter((book) => book.shelf === "dnf");
  const finished = books.filter((book) => book.shelf === "read");
  if (abandoned.length >= 2 && finished.length >= 5) {
    const rate = finished.length / (finished.length + abandoned.length);
    if (rate < 0.8) clauses.push("abandons freely rather than finishing out of duty");
    else if (rate > 0.95) clauses.push("almost always finishes what they start");
  }

  const repeatOffender = disliked.find((author) => author.count >= 2);
  if (repeatOffender) {
    clauses.push(`has given up on ${repeatOffender.author} more than once`);
  }

  if (rated.length >= 8) {
    const overall = mean(rated.map((book) => book.rating!));
    if (overall >= 4.2) clauses.push("rates generously, so 3 stars reads as a real miss");
    else if (overall <= 2.8) clauses.push("rates harshly, so 4 stars is a strong endorsement");
  }

  if (clauses.length === 0) return null;
  const sentence = clauses.slice(0, 3).join("; ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

export function buildTasteProfile(books: readonly Book[]): TasteProfile {
  const counts = { tbr: 0, read: 0, dnf: 0 } as Record<Shelf, number>;
  for (const book of books) counts[book.shelf] += 1;

  const ratings = books.filter((book) => book.rating).map((book) => book.rating!);
  const started = counts.read + counts.dnf;
  const buckets = bucketByAuthor(books);
  const disliked = rankDisliked(buckets);

  const recentlyFinished = books
    .filter((book) => book.shelf === "read")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)
    .map(({ title, rating }) => ({ title, rating }));

  return {
    counts,
    totalRated: ratings.length,
    averageRating: ratings.length ? round(mean(ratings)) : null,
    loved: rankLoved(buckets),
    disliked,
    eras: eraShares(books),
    finishingRate: started > 0 ? Math.round((counts.read / started) * 100) : null,
    recentlyFinished,
    signal: deriveSignal(books, disliked),
    sparse: started < SPARSE_THRESHOLD || ratings.length === 0,
  };
}
