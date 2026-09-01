import { library } from "@/lib/store/store";
import { asRating, type Shelf } from "@/lib/types";
import { isIsoDate } from "@/lib/utils/date";

/**
 * Goodreads CSV import.
 *
 * One caller, `ImportPanel`. It lives beside `seed.ts` because both do the same
 * job: bulk-loading records into the store from outside.
 *
 * Deliberately minimal. It reads five columns and ignores every other thing
 * Goodreads exports, which is most of them.
 */

/** Minimal CSV reader: handles quoted fields and embedded commas, nothing more. */
function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells.map((value) => value.trim());
}

const GOODREADS_SHELF: Record<string, Shelf> = {
  "to-read": "tbr",
  read: "read",
  "currently-reading": "tbr",
  abandoned: "dnf",
  "did-not-finish": "dnf",
  dnf: "dnf",
};

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

/**
 * Goodreads' `Date Read` to `YYYY-MM-DD`.
 *
 * Exports use `2019/03/12` in some accounts and `Mar 12, 2019` in others,
 * depending on the locale the export was generated under, and the column is
 * routinely blank for books still on to-read. Anything unrecognised returns
 * `undefined` and falls back to the store's own stamping: a wrong reading date
 * is worse than an absent one.
 */
function parseGoodreadsDate(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value) return undefined;

  const numeric = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(value);
  if (numeric) {
    const [, y, m, d] = numeric;
    const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : undefined;
  }

  const named = /^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/i.exec(value);
  if (named) {
    const month = MONTHS.indexOf(named[1].toLowerCase());
    if (month === -1) return undefined;
    const iso = `${named[3]}-${`${month + 1}`.padStart(2, "0")}-${named[2].padStart(2, "0")}`;
    return isIsoDate(iso) ? iso : undefined;
  }

  return undefined;
}

export interface ImportOutcome {
  added: number;
  duplicates: number;
  skipped: number;
}

export function importGoodreadsCsv(csv: string): ImportOutcome {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return { added: 0, duplicates: 0, skipped: 0 };

  const headers = parseCsvRow(lines[0]).map((header) => header.toLowerCase());
  const titleAt = headers.findIndex((header) => header.includes("title"));
  const authorAt = headers.findIndex((header) => header === "author" || header.includes("author"));
  const shelfAt = headers.findIndex((header) => header.includes("shelf"));
  const ratingAt = headers.findIndex((header) => header.includes("my rating"));
  const readAt = headers.findIndex((header) => header === "date read");

  if (titleAt === -1) return { added: 0, duplicates: 0, skipped: lines.length - 1 };

  let skipped = 0;
  const candidates = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvRow(line);
    const title = cells[titleAt];
    if (!title) {
      skipped += 1;
      continue;
    }

    const rawShelf = shelfAt === -1 ? "" : cells[shelfAt]?.toLowerCase();
    const rating = ratingAt === -1 ? undefined : asRating(Number.parseInt(cells[ratingAt], 10));

    candidates.push({
      title,
      author: (authorAt === -1 ? "" : cells[authorAt]) || "Unknown",
      shelf: GOODREADS_SHELF[rawShelf] ?? "tbr",
      rating,
      endedAt: readAt === -1 ? undefined : parseGoodreadsDate(cells[readAt]),
    });
  }

  const { added, duplicates } = library.addMany(candidates);
  return { added, duplicates, skipped };
}
