"use client";

import Link from "next/link";
import { BookCover } from "@/components/molecules/BookCover";
import { StarRating } from "@/components/molecules/StarRating";
import type { AuthorAffinity, Book, TasteProfile as Profile } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

interface TasteProfileProps {
  profile: Profile;
  /** Finished books, newest first — rendered as covers rather than a list. */
  recent: readonly Book[];
}

/**
 * The reading profile, laid out as an essay rather than a dashboard.
 *
 * This is the same data `get_taste_profile` hands an agent — but rendered for a
 * person, not mirrored as a payload. The reader already sees everything the
 * agent is told, because the page *is* the profile; printing the raw tool
 * output alongside would add developer-facing noise to what should read as an
 * essay about someone's reading.
 */
export function TasteProfile({ profile, recent }: TasteProfileProps) {
  if (profile.sparse) {
    return (
      <div className="mx-auto max-w-2xl border border-dashed border-rule px-8 py-20 text-center">
        <h2 className="font-display text-3xl text-balance text-ink">
          Not enough history yet
        </h2>
        <p className="mt-3 text-pretty text-ink-soft">
          Rate a few books you have finished and a profile will build itself
          here — the same one your agent reads before recommending anything.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      {profile.signal && (
        <blockquote className="max-w-3xl">
          <p className="u-meta text-ink-faint">What your shelves say</p>
          <p className="font-display mt-3 text-[clamp(1.6rem,4vw,2.6rem)] leading-[1.15] text-balance text-ink">
            {profile.signal}
          </p>
        </blockquote>
      )}

      <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-6 border-y border-rule py-6 sm:grid-cols-4">
        <Figure label="Books rated" value={profile.totalRated} />
        <Figure label="Average rating" value={profile.averageRating?.toFixed(1) ?? "—"} />
        <Figure
          label="Finish rate"
          value={profile.finishingRate === null ? "—" : `${profile.finishingRate}%`}
        />
        <Figure label="Abandoned" value={profile.counts.dnf} />
      </dl>

      <div className="mt-12 grid gap-x-10 gap-y-12 md:grid-cols-2">
        {profile.loved.length > 0 && (
          <AuthorList
            heading="Authors you love"
            note="Rated four stars or better, more than once."
            tone="text-shelf-read"
            authors={profile.loved}
            render={(author) => (
              <StarRating value={roundToRating(author.averageRating)} readOnly size={12} />
            )}
          />
        )}

        {profile.disliked.length > 0 && (
          <AuthorList
            heading="Authors you put down"
            note="Abandoned, or rated poorly. The strongest signal you give."
            tone="text-shelf-dnf"
            authors={profile.disliked}
            render={(author) => (
              <span className="u-meta u-tnum text-ink-faint">
                {author.abandoned > 0
                  ? `${author.abandoned} abandoned`
                  : `avg ${author.averageRating.toFixed(1)}`}
              </span>
            )}
          />
        )}
      </div>

      {profile.eras.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl text-ink">When your books were written</h2>
          <ul className="mt-4 flex flex-col gap-2.5">
            {profile.eras.map((era) => (
              <li key={era.decade} className="flex items-center gap-4">
                <span className="u-meta u-tnum w-12 shrink-0 text-ink-soft">{era.decade}s</span>
                <span className="h-2 flex-1 bg-paper-sunk">
                  <span
                    style={{ width: `${era.share}%` }}
                    className="block h-full bg-accent/70 transition-[width] duration-500 ease-[var(--ease-out-soft)]"
                  />
                </span>
                <span className="u-meta u-tnum w-10 shrink-0 text-right text-ink-faint">
                  {era.share}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-xl text-ink">Recently finished</h2>
          <ul className="mt-4 grid grid-cols-3 gap-x-5 gap-y-6 sm:grid-cols-5 lg:grid-cols-6">
            {recent.map((book) => (
              <li key={book.id}>
                <Link href={`/book?id=${book.id}`} className="group block">
                  <div className="transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:-translate-y-1">
                    <BookCover
                      title={book.title}
                      author={book.author}
                      coverId={book.coverId}
                    />
                  </div>
                  <p className="font-display mt-2 text-[0.85rem] leading-tight text-balance text-ink">
                    {book.title}
                  </p>
                  {book.rating && (
                    <StarRating value={book.rating} readOnly size={11} className="mt-1" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="u-meta text-ink-faint">{label}</dt>
      <dd className="font-display u-tnum mt-1 text-3xl leading-none text-ink">{value}</dd>
    </div>
  );
}

interface AuthorListProps {
  heading: string;
  note: string;
  tone: string;
  authors: AuthorAffinity[];
  render: (author: AuthorAffinity) => React.ReactNode;
}

function AuthorList({ heading, note, tone, authors, render }: AuthorListProps) {
  return (
    <section>
      <h2 className={cn("font-display text-xl", tone)}>{heading}</h2>
      <p className="mt-1 text-[0.8125rem] text-pretty text-ink-faint">{note}</p>
      <ul className="mt-4 flex flex-col">
        {authors.map((author) => (
          <li
            key={author.author}
            className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5 last:border-b-0"
          >
            <span className="text-ink">{author.author}</span>
            <span className="flex shrink-0 items-center gap-3">
              {render(author)}
              <span className="u-meta u-tnum w-12 text-right text-ink-faint">
                {author.count} {author.count === 1 ? "book" : "books"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Star display needs a whole number; the average is deliberately not rounded elsewhere. */
function roundToRating(average: number) {
  const rounded = Math.round(average);
  return (rounded < 1 ? 1 : rounded > 5 ? 5 : rounded) as 1 | 2 | 3 | 4 | 5;
}
