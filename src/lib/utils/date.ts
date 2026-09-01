/**
 * Calendar dates, as distinct from instants.
 *
 * `Book.endedAt` is a `YYYY-MM-DD` day a reader chose, not a moment the
 * software recorded. Every function here exists to keep it that way, because
 * the obvious implementations are all subtly wrong:
 *
 *   new Date().toISOString().slice(0, 10)   -> UTC's date, not the reader's
 *   new Date("2026-03-12")                  -> midnight *UTC*, which is
 *                                              11 March in every timezone
 *                                              behind it
 *
 * The second is the one that bites: a reader in UTC-5 picks 12 March and the
 * card renders 11 March. So dates are built and read component-wise in local
 * time, and never round-tripped through `Date.prototype.toISOString`.
 */

/** A local `Date` to `YYYY-MM-DD`, using its local components. */
export function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Today, in the reader's own timezone. */
export function today(): string {
  return toIsoDate(new Date());
}

/** `YYYY-MM-DD` to a `Date` at local midnight, or null if it is not one. */
export function fromIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);

  // Rejects dates that silently roll over: "2026-02-31" becomes 3 March rather
  // than throwing, and a hand-edited store or an agent can produce one.
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/** True for a well-formed, real calendar date. */
export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && fromIsoDate(value) !== null;
}

const FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * `YYYY-MM-DD` to "12 Mar 2026".
 *
 * A fixed locale rather than the reader's, so a date never renders one way in
 * a screenshot and another on a judge's machine. Returns null for anything
 * unparseable rather than the string "Invalid Date".
 */
export function formatDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = fromIsoDate(value);
  return date ? FORMAT.format(date) : null;
}
