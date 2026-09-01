import { library } from "@/lib/store/store";
import { asRating, type Shelf } from "@/lib/types";

/**
 * Goodreads CSV import.
 *
 * This was once shared between the paste field and an `import_books` WebMCP
 * tool. The tool is gone — a host security review rejected it, and the reasons
 * were structural rather than cosmetic (docs/07-risks.md, R11) — so the parser
 * now has one caller: `ImportPanel`. It lives beside `seed.ts` because both do
 * the same job, bulk-loading records into the store from outside.
 *
 * Deliberately minimal. It reads four columns and ignores every other thing
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
    });
  }

  const { added, duplicates } = library.addMany(candidates);
  return { added, duplicates, skipped };
}
