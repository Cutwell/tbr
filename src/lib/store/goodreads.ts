import { library } from "@/lib/store/store";
import { asRating, type NewBook, type Shelf } from "@/lib/types";
import { instantAtStartOfDay, isIsoDate } from "@/lib/utils/date";

/**
 * Goodreads CSV import.
 *
 * One caller, `ImportPanel`. It lives beside `seed.ts` because both do the same
 * job: bulk-loading records into the store from outside.
 *
 * Six of the twenty-three exported columns are read and the rest are ignored —
 * but ignoring a column is not the same as being unaware of it. The full schema
 * is declared in `GOODREADS_COLUMNS` below, and the parser is built for the
 * whole of it, because two of the columns TBR never looks at are the ones most
 * likely to destroy an import.
 */

/**
 * Every column Goodreads exports, in the order it writes them.
 *
 * Declared in full so that binding a column is a checked lookup against a known
 * schema rather than a guess — `columnIndex` will not compile against a name
 * that is not on this list. A union rather than an array because none of it is
 * needed at run time: the schema's whole job is to be read, by the compiler and
 * by the next person.
 *
 * The previous implementation matched headers by substring, and survived only
 * on the spelling of "Bookshelves" — it contains "shelve", not "shelf", which
 * is the single accident that kept it from being read as the shelf column in
 * place of "Exclusive Shelf". Code should not depend on that.
 *
 * Names are matched case-insensitively and nothing else. A column missing from
 * a file simply does not bind, and an unrecognised one is passed over in
 * silence — which is what lets a hand-trimmed CSV, including this panel's own
 * five-column example, import cleanly.
 */
type GoodreadsColumn =
  | "Book Id"
  | "Title"
  | "Author"
  | "Author l-f"
  | "Additional Authors"
  | "ISBN"
  | "ISBN13"
  | "My Rating"
  | "Publisher"
  | "Binding"
  | "Number of Pages"
  | "Year Published"
  | "Original Publication Year"
  | "Date Read"
  | "Date Added"
  | "Bookshelves"
  | "Bookshelves with positions"
  | "Exclusive Shelf"
  | "My Review"
  | "Spoiler"
  | "Private Notes"
  | "Read Count"
  | "Owned Copies";

/**
 * A CSV reader, over the whole document rather than a line at a time.
 *
 * This is the part that has to know about `My Review` and `Private Notes`. Both
 * are free text a reader typed, both routinely contain line breaks, and CSV
 * carries a line break inside a quoted field as data. Splitting the file on
 * newlines first therefore tears a single book into pieces: the tail of a
 * two-paragraph review becomes its own "row", and a fragment with a comma in it
 * parses as a book — one real import produced a title of "ambiguous" by an
 * author of "and honest about the cost.,,,1,1".
 *
 * So a newline ends a row only when it is not inside quotes, which means the
 * split belongs here, in the one place that tracks whether it is. Handles CRLF
 * and LF, doubled quotes as an escaped quote, and a UTF-8 BOM.
 */
function parseCsv(text: string): string[][] {
  // Goodreads writes UTF-8 and some tools prepend a BOM. Left in place it fuses
  // to the first header, so "Book Id" never matches and — in a file trimmed to
  // start with Title — nothing binds at all.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (quoted) {
      if (char !== '"') {
        cell += char;
      } else if (input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      // CRLF is one terminator, not two.
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  // Blank lines between records, and the trailing newline every export ends
  // with. A blank line *inside* a quoted review is not one of these — it was
  // consumed as cell content above and never reached this point.
  return rows
    .map((cells) => cells.map((value) => value.trim()))
    .filter((cells) => cells.some((value) => value.length > 0));
}

/** Binds one known column, or -1 when the file does not carry it. */
function columnIndex(headers: string[], column: GoodreadsColumn): number {
  const wanted = column.toLowerCase();
  return headers.findIndex((header) => header === wanted);
}

/**
 * Goodreads shelf names to ours.
 *
 * Only the first three are Goodreads' own: `read`, `currently-reading` and
 * `to-read` are the exclusive shelves every account has, and the rest are names
 * readers give custom ones. `currently-reading` maps to `tbr` because a book
 * being read has not ended, which is the same thing `tbr` means here.
 */
const GOODREADS_SHELF: Record<string, Shelf> = {
  read: "read",
  "currently-reading": "tbr",
  "to-read": "tbr",
  abandoned: "dnf",
  "did-not-finish": "dnf",
  "gave-up": "dnf",
  dnf: "dnf",
  unfinished: "dnf",
};

/**
 * Which shelf a row lands on, from two columns rather than one.
 *
 * Goodreads has no shelf for a book you gave up on. A reader who abandons
 * something has to leave it filed under `read` or `to-read` and tag it on a
 * custom shelf, so `Exclusive Shelf` alone can never produce a `dnf` — and
 * abandonment is the strongest signal the taste profile has. `Bookshelves` is
 * where that tag actually lives, which is why a column TBR otherwise ignores
 * gets consulted here, and why it wins: it is more specific than the exclusive
 * shelf it is contradicting.
 */
function resolveShelf(exclusive: string, bookshelves: string): Shelf {
  const tagged = bookshelves
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .some((tag) => GOODREADS_SHELF[tag] === "dnf");
  if (tagged) return "dnf";

  return GOODREADS_SHELF[exclusive.toLowerCase()] ?? "tbr";
}

const MONTHS = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

/**
 * A Goodreads date to `YYYY-MM-DD`.
 *
 * Exports use `2019/03/12` in some accounts and `Mar 12, 2019` in others,
 * depending on the locale the export was generated under, and both date columns
 * are routinely blank — `Date Read` for anything still on to-read. Anything
 * unrecognised returns `undefined` and falls back to the store's own stamping:
 * a wrong date is worse than an absent one.
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
  const rows = parseCsv(csv);
  if (rows.length < 2) return { added: 0, duplicates: 0, skipped: 0 };

  const headers = rows[0].map((header) => header.toLowerCase());
  const titleAt = columnIndex(headers, "Title");
  const authorAt = columnIndex(headers, "Author");
  const exclusiveAt = columnIndex(headers, "Exclusive Shelf");
  const bookshelvesAt = columnIndex(headers, "Bookshelves");
  const ratingAt = columnIndex(headers, "My Rating");
  const readAt = columnIndex(headers, "Date Read");
  const addedAt = columnIndex(headers, "Date Added");

  if (titleAt === -1) return { added: 0, duplicates: 0, skipped: rows.length - 1 };

  /** A cell by column index, or "" when the column is absent or the row short. */
  const at = (cells: string[], index: number) => (index === -1 ? "" : (cells[index] ?? ""));

  let skipped = 0;
  const candidates: NewBook[] = [];

  for (const cells of rows.slice(1)) {
    const title = at(cells, titleAt);
    if (!title) {
      skipped += 1;
      continue;
    }

    const shelf = resolveShelf(at(cells, exclusiveAt), at(cells, bookshelvesAt));
    // Goodreads writes 0 for unrated, which `asRating` rejects along with
    // anything else out of range.
    const rating = asRating(Number.parseInt(at(cells, ratingAt), 10));

    candidates.push({
      title,
      author: at(cells, authorAt) || "Unknown",
      shelf,
      rating,
      // A finish date on a book you still intend to read is a contradiction;
      // the store discards it either way, and not sending it says so here too.
      endedAt: shelf === "tbr" ? undefined : parseGoodreadsDate(at(cells, readAt)),
      // Without this every imported book claims it was added this afternoon,
      // and a 200-book shelf reads as one afternoon's work. The store still
      // stamps now for any row whose date is missing or unparseable.
      addedAt: instantAtStartOfDay(parseGoodreadsDate(at(cells, addedAt))),
    });
  }

  const { added, duplicates } = library.addMany(candidates);
  return { added, duplicates, skipped };
}
