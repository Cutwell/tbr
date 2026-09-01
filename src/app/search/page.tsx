"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Skeleton } from "@/components/atoms/Skeleton";
import { BookCover } from "@/components/molecules/BookCover";
import { SearchField } from "@/components/molecules/SearchField";
import { ImportPanel } from "@/components/organisms/ImportPanel";
import { searchCatalog } from "@/lib/catalog/openlibrary";
import { notify } from "@/lib/store/notifications";
import { library } from "@/lib/store/store";
import { useLibrary } from "@/lib/store/useLibrary";
import type { CatalogResult } from "@/lib/types";

const DEBOUNCE_MS = 300;

/**
 * Catalogue search and add — its own page rather than a panel over the shelf.
 *
 * Searching for a book to add and browsing what you already own are different
 * intentions, and stacking them made the shelf carry two jobs at once. Given a
 * page, search gets the room to show cover art at a size worth looking at.
 *
 * Only the human path is debounced. Agents call `search_catalog` once with a
 * considered query; there is nothing to throttle.
 */
function SearchPage() {
  const params = useSearchParams();
  const books = useLibrary();

  const [query, setQuery] = useState(() => params.get("q") ?? "");
  const [results, setResults] = useState<CatalogResult[]>([]);

  /**
   * The App Router keeps this page mounted across `/search?q=...`
   * navigations, so the `useState` initialiser above only ever fires once.
   * Without this, a `navigate_to` call that changes `q` while the reader is
   * already here would update the URL but leave the box showing the old
   * query. `syncedQuery` tracks the last URL value applied — same
   * derive-during-render pattern as `book/page.tsx`'s fetched state — so this
   * only fires on an actual URL change, not on every keystroke: the human
   * typing path owns `query` from there via `handleQueryChange`.
   */
  const [syncedQuery, setSyncedQuery] = useState(query);
  const paramQuery = params.get("q") ?? "";
  if (paramQuery && paramQuery !== syncedQuery) {
    setSyncedQuery(paramQuery);
    setQuery(paramQuery);
  }

  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * `?import=1` opens the Goodreads panel on arrival, which is how the
   * first-run panel links here. An initialiser is enough: that link is only
   * ever offered from the shelf, so this page is mounting, not re-rendering.
   */
  const [showImport, setShowImport] = useState(() => params.get("import") === "1");
  const requestId = useRef(0);

  const ownedKeys = useMemo(
    () => new Set(books.map((book) => book.olKey).filter((key): key is string => Boolean(key))),
    [books],
  );

  function handleQueryChange(next: string) {
    setQuery(next);
    if (next.trim().length < 2) {
      requestId.current += 1; // Abandon any answer still in flight.
      setResults([]);
      setBusy(false);
      setFailed(false);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const id = ++requestId.current;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const found = await searchCatalog(trimmed, 18, controller.signal);
        if (id !== requestId.current) return; // A newer keystroke won.
        setResults(found);
        setFailed(false);
      } catch (error) {
        if (controller.signal.aborted || id !== requestId.current) return;
        setResults([]);
        setFailed(true);
        console.error("Catalogue search failed", error);
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function handleAdd(result: CatalogResult) {
    const { book, duplicate } = library.add({ ...result, shelf: "tbr" });
    notify({
      message: duplicate
        ? `“${book.title}” is already on your ${book.shelf} shelf.`
        : `Added “${book.title}” to your list.`,
    });
  }

  function handleAddManual() {
    const title = query.trim();
    const { book, duplicate } = library.add({ title, author: "Unknown", shelf: "tbr" });
    notify({
      message: duplicate ? `“${book.title}” is already here.` : `Added “${book.title}”.`,
    });
    setQuery("");
  }

  const trimmed = query.trim();
  const showManual = trimmed.length >= 2 && !busy && (failed || results.length === 0);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <SearchField
        value={query}
        onChange={handleQueryChange}
        busy={busy}
        autoFocus
        placeholder="Search by title, author, series or year"
      />

      <p className="u-meta mt-3 text-ink-faint">
        Searching Open Library · new books land on your to-read shelf
      </p>

      {/* Only while there is nothing to show yet — replacing live results with
          skeletons on every keystroke would flicker worse than leaving them. */}
      {busy && results.length === 0 && (
        <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <li key={index} className="flex flex-col gap-2">
              <Skeleton className="aspect-2/3 w-full" delay={index * 60} />
              <Skeleton className="h-3.5 w-4/5" delay={index * 60} />
              <Skeleton className="h-2.5 w-3/5" delay={index * 60} />
            </li>
          ))}
        </ul>
      )}

      {results.length > 0 && (
        <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
          {results.map((result, index) => {
            const owned = ownedKeys.has(result.olKey);
            return (
              <li
                key={result.olKey}
                style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                className="animate-rise group flex flex-col gap-2"
              >
                {/* The Add button sits outside this link on purpose: nesting a
                    button inside an anchor is invalid markup and breaks both
                    click handling and screen readers. */}
                <Link href={`/book?id=${result.olKey}`} className="flex flex-col gap-2">
                  <div className="transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:-translate-y-1">
                    <BookCover
                      title={result.title}
                      author={result.author}
                      coverId={result.coverId}
                    />
                  </div>
                  <p className="font-display text-[0.9rem] leading-tight text-balance text-ink transition-colors duration-150 group-hover:text-accent">
                    {result.title}
                  </p>
                  <p className="u-meta text-ink-faint">
                    {result.author}
                    {result.year ? ` · ${result.year}` : ""}
                  </p>
                </Link>
                <Button
                  size="sm"
                  variant={owned ? "quiet" : "outline"}
                  disabled={owned}
                  onClick={() => handleAdd(result)}
                  className="mt-auto w-full"
                >
                  {owned ? (
                    <>
                      <Icon name="check" size={14} /> On shelf
                    </>
                  ) : (
                    <>
                      <Icon name="plus" size={14} /> Add
                    </>
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {showManual && (
        <div className="mt-10 border-t border-rule pt-6">
          <p className="text-sm text-pretty text-ink-soft">
            {failed
              ? "The catalogue is not responding."
              : `Nothing in the catalogue matches “${trimmed}”.`}{" "}
            You can still add it by hand.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleAddManual}>
            <Icon name="plus" size={14} />
            Add “{trimmed}” anyway
          </Button>
        </div>
      )}

      <section className="mt-16 border-t border-rule pt-6">
        <button
          type="button"
          onClick={() => setShowImport((open) => !open)}
          aria-expanded={showImport}
          className="u-meta flex items-center gap-1.5 text-ink-faint transition-colors hover:text-ink"
        >
          <Icon name="upload" size={13} />
          Import from Goodreads
        </button>
        {showImport && (
          <div className="mt-4">
            <ImportPanel onDone={() => setShowImport(false)} />
          </div>
        )}
      </section>
    </div>
  );
}

export default function SearchRoute() {
  // `useSearchParams` needs a Suspense boundary during prerendering.
  return (
    <Suspense fallback={null}>
      <SearchPage />
    </Suspense>
  );
}
