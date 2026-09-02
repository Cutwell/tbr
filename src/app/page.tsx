"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonStyles } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { TextInput } from "@/components/atoms/TextInput";
import { EmptyState } from "@/components/molecules/EmptyState";
import { FilterBar } from "@/components/molecules/FilterBar";
import { SHELF_LABEL } from "@/components/molecules/ShelfBadge";
import { SortControl } from "@/components/molecules/SortControl";
import { BookGrid } from "@/components/organisms/BookGrid";
import { FirstRunPanel } from "@/components/organisms/FirstRunPanel";
import { requestConfirmation } from "@/lib/store/confirmations";
import { usePendingNavigation } from "@/lib/store/navigation";
import { notify } from "@/lib/store/notifications";
import {
  getShelfView,
  openingShelf,
  orderBooks,
  rememberShelfView,
  type SortKey,
} from "@/lib/store/shelfView";
import { library } from "@/lib/store/store";
import { useLibrary, useRecentIds } from "@/lib/store/useLibrary";
import type { Rating, Shelf } from "@/lib/types";

export default function ShelfPage() {
  const books = useLibrary();
  const highlighted = useRecentIds();

  /**
   * Filter, search and order are seeded from `shelfView` and written back to
   * it on every change, so opening a book and coming back returns the reader to
   * the view they left rather than to the default one. See shelfView.ts for why
   * that state cannot live here alone.
   *
   * The initialisers read a module constant on the server and the same constant
   * on the client's first render, so there is nothing for hydration to disagree
   * about.
   */
  const [shelf, setShelfState] = useState<Shelf | null>(() => getShelfView().shelf);
  const [search, setSearchState] = useState(() => getShelfView().search);
  const [sort, setSortState] = useState<SortKey>(() => getShelfView().sort);
  const [settled, setSettled] = useState(() => getShelfView().settled);

  function setShelf(next: Shelf | null) {
    setShelfState(next);
    rememberShelfView({ shelf: next });
  }

  function setSearch(next: string) {
    setSearchState(next);
    rememberShelfView({ search: next });
  }

  function setSort(next: SortKey) {
    setSortState(next);
    rememberShelfView({ sort: next });
  }

  /**
   * `navigate_to` can ask for a shelf filter (or ask to clear one) alongside a
   * route change. `shelf` on the command is `undefined` when it has no opinion
   * — distinct from `null`, which means "show every shelf" — so only an
   * explicit value here touches the reader's current filter.
   *
   * Applied by comparison during render, the same pattern `book/page.tsx` uses
   * for its fetched state: `handledNavId` tracks the last command this page
   * acted on, so a command already pending before this page mounted still
   * applies, and each command applies exactly once even though this page stays
   * mounted across `/` navigations. `setState` here runs conditionally in the
   * render body rather than in an effect — React re-renders before painting,
   * with no extra commit the reader would see. `setShelf` also writes through
   * to `shelfView`, so an agent's filter is the one the reader returns to; it
   * is an idempotent assignment, which is what makes it safe to run from a
   * render React may replay.
   */
  const pendingNav = usePendingNavigation();
  const [handledNavId, setHandledNavId] = useState(0);

  if (pendingNav && pendingNav.id !== handledNavId) {
    setHandledNavId(pendingNav.id);
    if (pendingNav.shelf !== undefined) setShelf(pendingNav.shelf);
  }

  const counts = useMemo(() => {
    const tally = { tbr: 0, read: 0, dnf: 0 } as Record<Shelf, number>;
    for (const book of books) tally[book.shelf] += 1;
    return tally;
  }, [books]);

  /**
   * Settle the opening shelf, on the first render where the library is known.
   *
   * The default is TBR, but a reader whose TBR shelf is empty would open on
   * "That shelf is empty" — a blank page in front of a library they can see the
   * counts for. They open on All instead.
   *
   * It cannot be decided in the `useState` initialiser above: the library
   * hydrates on mount, so on the first render every shelf is empty and the
   * answer would always be All. `books.length > 0` is the signal that the
   * question can now be answered — the same "empty means not yet" reading
   * `book/page.tsx` uses.
   *
   * `settled` guards it to once per session, not once per mount, which is why
   * it lives in `shelfView` alongside the filter. Deciding again on a later
   * mount would take a reader who deliberately opened an empty TBR shelf and
   * drop them back on All. The writes here run in the render body for the same
   * reason the block above does, and are idempotent for the same reason: the
   * guard is component state React has not committed yet, so a replayed render
   * writes the same values.
   */
  if (!settled && books.length > 0) {
    setSettled(true);
    rememberShelfView({ settled: true });
    setShelf(openingShelf(counts.tbr));
  }

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matched = books.filter((book) => {
      if (shelf && book.shelf !== shelf) return false;
      if (!needle) return true;
      return `${book.title} ${book.author}`.toLowerCase().includes(needle);
    });
    return orderBooks(matched, sort);
  }, [books, shelf, search, sort]);

  /*
   * A filter is anything hiding books, so the default tbr shelf counts as one
   * and this reads true on a fresh visit. That is deliberate: the landing view
   * is now a filtered view, and a reader who cannot find a book they know they
   * own needs to be told why before they conclude it is gone.
   *
   * Sort is not a filter — it hides nothing — so it neither shows this button
   * nor is reset by it.
   */
  const filtered = shelf !== null || search.trim().length > 0;

  function clearFilters() {
    setShelf(null);
    setSearch("");
  }

  function handleSetShelf(id: string, next: Shelf) {
    const updated = library.update(id, { shelf: next });
    if (updated) notify({ message: `“${updated.title}” → ${SHELF_LABEL[next]}.` });
  }

  /**
   * Rating a book on the tbr shelf moves it to read — the store does that, so
   * an agent's rating behaves identically (store.ts).
   *
   * The move is inferred rather than asked for, which earns it a toast and an
   * undo. Anything the software decides on the reader's behalf has to be both
   * visible and one click from reversed.
   */
  function handleRate(id: string, rating: Rating | undefined) {
    const before = library.get(id);
    // `StarRating` clears by handing back `undefined`, which the patch reads as
    // "leave the rating alone" — so it has to become an explicit `null`.
    const updated = library.update(id, { rating: rating ?? null });
    if (!before || !updated || before.shelf === updated.shelf) return;

    notify({
      message: `“${updated.title}” rated — moved to ${SHELF_LABEL[updated.shelf]}.`,
      action: { label: "Undo", run: () => library.update(id, { shelf: before.shelf }) },
    });
  }

  /**
   * Deletion goes through the same confirmation store the agent uses, so there
   * is exactly one path to destroying a book — and it always asks first.
   */
  async function handleRemove(id: string) {
    const book = library.get(id);
    if (!book) return;

    const confirmed = await requestConfirmation({
      title: `Remove “${book.title}”?`,
      body: `${book.author}. This deletes it from your list permanently.`,
      confirmLabel: "Remove it",
    });
    if (!confirmed) return;

    const removed = library.remove(id);
    if (!removed) return;

    notify({
      message: `Removed “${removed.title}”.`,
      action: { label: "Undo", run: () => library.restore(removed) },
    });
  }

  return (
    <>
      {/* Nothing to filter and nothing to count. Shelf tabs reading zero and a
          box that filters an empty list are noise above the first-run panel. */}
      {books.length > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <FilterBar active={shelf} counts={counts} total={books.length} onChange={setShelf} />

          {/* Arrange and search share a row on a wide screen and take one each
              on a narrow one — three controls abreast at 375px leaves the
              search box too narrow to read its own placeholder. */}
          <div className="flex w-full flex-wrap items-end gap-x-6 gap-y-4 sm:w-auto">
            <SortControl value={sort} shelf={shelf} onChange={setSort} />

            <div className="flex w-full items-end gap-4 sm:w-auto">
              <label className="flex min-w-0 flex-1 items-end gap-2 sm:w-72 sm:flex-none">
                <span className="sr-only">Filter your shelves</span>
                <Icon name="search" size={16} className="mb-2 shrink-0 text-ink-faint" />
                <TextInput
                  type="search"
                  value={search}
                  placeholder="Filter your shelves"
                  onChange={(event) => setSearch(event.target.value)}
                  className="text-sm"
                />
              </label>

              {/* Only offered when there is something to clear — a permanently
                  present button that usually does nothing is just clutter. */}
              {filtered && (
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={clearFilters}
                  className="animate-fade mb-0.5 shrink-0"
                >
                  <Icon name="close" size={14} />
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={books.length > 0 ? "mt-9" : ""}>
        <BookGrid
          books={visible}
          highlighted={highlighted}
          onSetShelf={handleSetShelf}
          onRate={handleRate}
          onRemove={handleRemove}
          empty={
            books.length === 0 ? (
              <FirstRunPanel />
            ) : (
              <EmptyState
                title="No matches"
                description={
                  search.trim()
                    ? `Nothing here matches “${search.trim()}”. Try the catalogue instead.`
                    : "That shelf is empty. Try another filter."
                }
                action={
                  search.trim() ? (
                    <Link
                      href={`/search?q=${encodeURIComponent(search.trim())}`}
                      className={buttonStyles("outline")}
                    >
                      <Icon name="search" size={15} />
                      Search the catalogue
                    </Link>
                  ) : (
                    <Button variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )
                }
              />
            )
          }
        />
      </div>
    </>
  );
}
