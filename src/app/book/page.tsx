"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Button, buttonStyles } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { Skeleton, SkeletonText } from "@/components/atoms/Skeleton";
import { BookCover } from "@/components/molecules/BookCover";
import { SHELF_LABEL } from "@/components/molecules/ShelfBadge";
import { StarRating } from "@/components/molecules/StarRating";
import { fetchWorkDetail, lookupByKey, type WorkDetail } from "@/lib/catalog/openlibrary";
import { requestConfirmation } from "@/lib/store/confirmations";
import { notify } from "@/lib/store/notifications";
import { library } from "@/lib/store/store";
import { useLibrary } from "@/lib/store/useLibrary";
import { SHELVES, type CatalogResult, type Rating, type Shelf } from "@/lib/types";
import { isIsoDate, today } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

/**
 * One book, whether or not the reader owns it.
 *
 * The `id` parameter is either a local book id or an Open Library work key, so
 * a search result and a shelf card lead to the same page. That matters: deciding
 * whether to add a book needs exactly the information that deciding what to read
 * next needs, and maintaining two detail views to say so would be silly.
 *
 * It is a query parameter rather than a path segment because the whole app is
 * statically exported: a dynamic segment would need `generateStaticParams`, and
 * the ids are runtime values — local uuids and arbitrary catalogue keys — that
 * cannot be enumerated at build time. A static route also removes the RSC
 * round trip on every navigation, so this is faster as well as portable.
 *
 * Synopsis and subjects are fetched here rather than stored on the record. They
 * would cost output budget on every WebMCP call that lists books, and no agent
 * needs a synopsis to recommend — but a reader choosing what to pick up tonight
 * very much does.
 */

/** Open Library work keys look like "OL59863W". */
function isWorkKey(value: string): boolean {
  return /^OL\d+W$/.test(value);
}

function BookDetail() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const books = useLibrary();

  // A work key resolves to the shelf copy when there is one, so arriving from
  // search at a book you already own shows the owned state, not a second "Add".
  const book =
    books.find((candidate) => candidate.id === id) ??
    books.find((candidate) => candidate.olKey === id);

  const olKey = book?.olKey ?? (isWorkKey(id) ? id : undefined);

  /**
   * Fetched state is tagged with the key it belongs to.
   *
   * Navigating between two books reuses this component, so state must be
   * invalidated when the key changes. Comparing during render does that by
   * derivation — no reset effect, and no window where the previous book's
   * synopsis renders under the new book's title.
   */
  const [loaded, setLoaded] = useState<{ key: string; detail: WorkDetail | null } | null>(null);
  const [resolved, setResolved] = useState<{ key: string; result: CatalogResult | null } | null>(
    null,
  );

  const detailFresh = loaded !== null && loaded.key === olKey;
  const detail = detailFresh ? loaded.detail : null;
  const loadingDetail = Boolean(olKey) && !detailFresh;

  // Only needed for a book that is not on a shelf: the shelf record already
  // carries its title, author and cover.
  const needsCatalogLookup = !book && Boolean(olKey);
  const resolvedFresh = resolved !== null && resolved.key === olKey;
  const catalogResult = resolvedFresh ? resolved.result : null;
  const resolving = needsCatalogLookup && !resolvedFresh;

  useEffect(() => {
    if (!olKey) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const found = await fetchWorkDetail(olKey, controller.signal);
        if (!controller.signal.aborted) setLoaded({ key: olKey, detail: found });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Work detail failed", error);
        // Record the attempt so the page stops waiting and says so.
        setLoaded({ key: olKey, detail: null });
      }
    })();

    return () => controller.abort();
  }, [olKey]);

  useEffect(() => {
    if (!needsCatalogLookup || !olKey) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const match = await lookupByKey(olKey, controller.signal);
        if (controller.signal.aborted) return;
        setResolved({ key: olKey, result: match });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Catalogue lookup failed", error);
        setResolved({ key: olKey, result: null });
      }
    })();

    return () => controller.abort();
  }, [needsCatalogLookup, olKey]);

  const display = book ?? catalogResult;

  if (!display) {
    // The library hydrates on mount, so an empty list means "not yet", not "gone".
    const stillWorking = resolving || books.length === 0;

    return (
      <div className={stillWorking ? "mx-auto w-full max-w-5xl" : "mx-auto max-w-lg py-24 text-center"}>
        {stillWorking ? (
          // The page's real shape, so nothing jumps when the record arrives.
          <div className="mt-8 grid gap-x-14 gap-y-10 md:grid-cols-[minmax(0,15rem)_1fr]">
            <Skeleton className="mx-auto aspect-2/3 w-40 md:mx-0 md:w-full" />
            <div className="min-w-0">
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="mt-4 h-5 w-2/5" delay={90} />
              <Skeleton className="mt-3 h-3 w-24" delay={180} />
              <Skeleton className="mt-8 h-20 w-full" delay={270} />
              <SkeletonText lines={4} className="mt-8 max-w-prose" />
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl text-ink">Nothing found</h1>
            <p className="mt-3 text-pretty text-ink-soft">
              This book is not on your shelves, and the catalogue has no record
              matching it.
            </p>
            <Link href="/" className={cn(buttonStyles("outline"), "mt-6")}>
              Back to the shelf
            </Link>
          </>
        )}
      </div>
    );
  }

  function setShelf(shelf: Shelf) {
    if (!book) return;
    const updated = library.update(book.id, { shelf });
    if (updated) notify({ message: `“${updated.title}” → ${SHELF_LABEL[shelf]}.` });
  }

  function setRating(rating: Rating | undefined) {
    if (book) library.update(book.id, { rating });
  }

  /**
   * The date input hands back "" when cleared, which has to become an explicit
   * `null` — `undefined` would mean "leave it alone" and the field would be
   * unclearable. Anything malformed is ignored rather than stored.
   */
  function setEndedAt(value: string) {
    if (!book) return;
    if (value === "") library.update(book.id, { endedAt: null });
    else if (isIsoDate(value)) library.update(book.id, { endedAt: value });
  }

  /** Adding flips this page into its owned state — `book` becomes defined. */
  function addToList() {
    if (!catalogResult) return;
    const { book: added, duplicate } = library.add({ ...catalogResult, shelf: "tbr" });
    notify({
      message: duplicate
        ? `“${added.title}” is already on your ${added.shelf} shelf.`
        : `Added “${added.title}” to your list.`,
    });
  }

  async function remove() {
    if (!book) return;

    const confirmed = await requestConfirmation({
      title: `Remove “${book.title}”?`,
      body: `${book.author}. This deletes it from your list permanently.`,
      confirmLabel: "Remove it",
    });
    if (!confirmed) return;

    const removed = library.remove(book.id);
    if (!removed) return;

    // Leave first: the record this page renders no longer exists.
    router.push("/");
    notify({
      message: `Removed “${removed.title}”.`,
      action: { label: "Undo", run: () => library.restore(removed) },
    });
  }

  const backHref = book ? "/" : "/search";
  const backLabel = book ? "The shelf" : "Search";

  return (
    <article className="mx-auto w-full max-w-5xl">
      <Link
        href={backHref}
        className="u-meta inline-flex items-center gap-1.5 text-ink-faint transition-colors hover:text-ink"
      >
        <Icon name="chevron" size={12} className="rotate-180" />
        {backLabel}
      </Link>

      <div className="mt-8 grid gap-x-14 gap-y-10 md:grid-cols-[minmax(0,15rem)_1fr]">
        <div className="mx-auto w-40 md:mx-0 md:w-full">
          <BookCover
            title={display.title}
            author={display.author}
            coverId={display.coverId}
            priority
          />
        </div>

        <div className="min-w-0">
          <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] text-balance text-ink">
            {display.title}
          </h1>
          <p className="mt-3 text-lg text-ink-soft">{display.author}</p>

          <p className="u-meta u-tnum mt-2 text-ink-faint">
            {[display.year, detail?.firstPublished].filter(Boolean)[0] ?? "Year unknown"}
          </p>

          <div className="mt-8 border-y border-rule py-5">
            {book ? (
              <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
                <div>
                  <p className="u-meta mb-2 text-ink-faint">Shelf</p>
                  <div className="flex gap-1.5">
                    {SHELVES.map((shelf) => (
                      <button
                        key={shelf}
                        type="button"
                        onClick={() => setShelf(shelf)}
                        aria-pressed={book.shelf === shelf}
                        className={cn(
                          "u-meta rounded-[3px] border px-2.5 py-1.5 transition-colors duration-150",
                          book.shelf === shelf
                            ? "border-ink bg-ink text-paper"
                            : "border-rule-strong text-ink-soft hover:border-ink-faint hover:text-ink",
                        )}
                      >
                        {SHELF_LABEL[shelf]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="u-meta mb-2 text-ink-faint">Rating</p>
                  <StarRating value={book.rating} onChange={setRating} size={20} />
                </div>

                {/* Only for a book that has ended. A "finished on" date on a
                    book you have not started is a field with no answer. */}
                {book.shelf !== "tbr" && (
                  <div>
                    <label
                      htmlFor="ended-at"
                      className="u-meta mb-2 block text-ink-faint"
                    >
                      {book.shelf === "read" ? "Finished" : "Gave up"}
                    </label>
                    <input
                      id="ended-at"
                      type="date"
                      value={book.endedAt ?? ""}
                      max={today()}
                      onChange={(event) => setEndedAt(event.target.value)}
                      className="u-meta u-tnum rounded-[3px] border border-rule-strong bg-paper px-2.5 py-1.5 text-ink transition-colors duration-150 hover:border-ink-faint focus:border-accent focus:outline-none"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="primary" onClick={addToList}>
                  <Icon name="plus" size={15} />
                  Add to my list
                </Button>
                <p className="u-meta text-ink-faint">Not on your shelves yet</p>
              </div>
            )}
          </div>

          {book?.note && (
            <p className="mt-6 border-l-2 border-accent pl-4 text-pretty text-ink-soft italic">
              {book.note}
            </p>
          )}

          <div className="mt-8 max-w-prose">
            {loadingDetail && <SkeletonText lines={4} />}

            {detail?.description ? (
              <p className="text-[1.0625rem] leading-relaxed text-pretty text-ink-soft">
                {detail.description}
              </p>
            ) : (
              !loadingDetail && (
                <p className="text-sm text-ink-faint italic">
                  {olKey
                    ? "Open Library has no synopsis for this one."
                    : "Added by hand, so there is nothing to look up."}
                </p>
              )
            )}
          </div>

          {detail && detail.subjects.length > 0 && (
            <ul className="mt-7 flex flex-wrap gap-1.5">
              {detail.subjects.map((subject) => (
                <li key={subject} className="u-meta border border-rule px-2 py-1 text-ink-faint">
                  {subject}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {olKey && (
              <a
                href={`https://openlibrary.org/works/${olKey}`}
                target="_blank"
                rel="noreferrer noopener"
                className={buttonStyles("outline", "sm")}
              >
                Open Library
                <Icon name="chevron" size={13} />
              </a>
            )}
            {book && (
              <Button variant="quiet" size="sm" onClick={remove} className="hover:text-accent">
                <Icon name="trash" size={14} />
                Remove from list
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function BookRoute() {
  // `useSearchParams` needs a Suspense boundary during prerendering.
  return (
    <Suspense fallback={null}>
      <BookDetail />
    </Suspense>
  );
}
