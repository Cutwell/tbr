/**
 * A small persistent cache for Open Library responses.
 *
 * Open Library serves `search.json` with **no cache headers at all**, so the
 * browser refetches every result on every reload — the single biggest reason
 * revisiting a page felt slow. Cover images do carry `max-age=10800`, so they
 * are the browser's problem, not ours; JSON is ours.
 *
 * Book metadata is effectively immutable — a 1974 novel's author is not going
 * to change — so a long TTL is safe and a stale entry is harmless.
 *
 * Every operation is wrapped: storage can be unavailable (private browsing),
 * full, or hold something another version wrote. A cache that throws is worse
 * than no cache, so every failure degrades to in-memory.
 */

interface Entry<T> {
  value: T;
  at: number;
}

interface Options {
  /** Storage key for the whole map. */
  name: string;
  /** How long an entry stays valid, in milliseconds. */
  ttl: number;
  /** Maximum entries before the oldest are evicted. */
  max: number;
}

/** Writes are debounced: search-as-you-type would otherwise reserialise per keystroke. */
const PERSIST_DELAY_MS = 500;

export class PersistentCache<T> {
  private readonly key: string;
  private readonly ttl: number;
  private readonly max: number;

  private entries = new Map<string, Entry<T>>();
  private hydrated = false;
  private persistTimer: ReturnType<typeof setTimeout> | undefined;

  constructor({ name, ttl, max }: Options) {
    this.key = `tbr.cache.${name}.v1`;
    this.ttl = ttl;
    this.max = max;
  }

  private hydrate(): void {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;

    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return;

      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return;

      const cutoff = Date.now() - this.ttl;
      for (const [name, entry] of Object.entries(parsed as Record<string, Entry<T>>)) {
        if (entry && typeof entry.at === "number" && entry.at > cutoff) {
          this.entries.set(name, entry);
        }
      }
    } catch {
      // Corrupt or unreadable — start empty rather than fail.
    }
  }

  private schedulePersist(): void {
    if (typeof window === "undefined") return;
    clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.persist(), PERSIST_DELAY_MS);
  }

  private persist(): void {
    try {
      // Insertion order is oldest-first, so trimming from the front evicts the
      // least recently written.
      const overflow = this.entries.size - this.max;
      if (overflow > 0) {
        let dropped = 0;
        for (const name of this.entries.keys()) {
          if (dropped++ >= overflow) break;
          this.entries.delete(name);
        }
      }
      window.localStorage.setItem(this.key, JSON.stringify(Object.fromEntries(this.entries)));
    } catch {
      // Quota exceeded or storage disabled. Drop the persisted copy and carry
      // on in memory — the library itself must never lose its slot to a cache.
      try {
        window.localStorage.removeItem(this.key);
      } catch {
        /* nothing further to try */
      }
    }
  }

  get(name: string): T | undefined {
    this.hydrate();
    const entry = this.entries.get(name);
    if (!entry) return undefined;

    if (Date.now() - entry.at > this.ttl) {
      this.entries.delete(name);
      return undefined;
    }
    return entry.value;
  }

  set(name: string, value: T): void {
    this.hydrate();
    // Re-inserting moves the key to the end, which is what makes eviction
    // recency-ordered rather than insertion-ordered.
    this.entries.delete(name);
    this.entries.set(name, { value, at: Date.now() });
    this.schedulePersist();
  }
}
