"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, buttonStyles } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { TextInput } from "@/components/atoms/TextInput";
import { EmptyState } from "@/components/molecules/EmptyState";
import { FilterBar } from "@/components/molecules/FilterBar";
import { SHELF_LABEL } from "@/components/molecules/ShelfBadge";
import { BookGrid } from "@/components/organisms/BookGrid";
import { FirstRunPanel } from "@/components/organisms/FirstRunPanel";
import { requestConfirmation } from "@/lib/store/confirmations";
import { usePendingNavigation } from "@/lib/store/navigation";
import { notify } from "@/lib/store/notifications";
import { library } from "@/lib/store/store";
import { useLibrary, useRecentIds } from "@/lib/store/useLibrary";
import type { Rating, Shelf } from "@/lib/types";

export default function ShelfPage() {
  const books = useLibrary();
  const highlighted = useRecentIds();

  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [search, setSearch] = useState("");

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
   * with no extra commit the reader would see.
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

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return books.filter((book) => {
      if (shelf && book.shelf !== shelf) return false;
      if (!needle) return true;
      return `${book.title} ${book.author}`.toLowerCase().includes(needle);
    });
  }, [books, shelf, search]);

  const filtered = shelf !== null || search.trim().length > 0;

  function clearFilters() {
    setShelf(null);
    setSearch("");
  }

  function handleSetShelf(id: string, next: Shelf) {
    const updated = library.update(id, { shelf: next });
    if (updated) notify({ message: `“${updated.title}” → ${SHELF_LABEL[next]}.` });
  }

  function handleRate(id: string, rating: Rating | undefined) {
    library.update(id, { rating });
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

          <div className="flex w-full items-end gap-4 sm:w-auto">
            <label className="flex flex-1 items-end gap-2 sm:w-72 sm:flex-none">
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
