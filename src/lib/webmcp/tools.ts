import { lookupByKey, searchCatalog } from "@/lib/catalog/openlibrary";
import { requestConfirmation } from "@/lib/store/confirmations";
import { goTo } from "@/lib/store/navigation";
import { notify } from "@/lib/store/notifications";
import { library } from "@/lib/store/store";
import { SHELVES, type Rating, type Shelf, type TasteProfile } from "@/lib/types";
import type { AgentHandle, ToolArgs, ToolDescriptor, ToolResponse } from "@/lib/webmcp/adapter";
import { err, ok, table } from "@/lib/webmcp/format";
import { readClampedInt, readEnum, readInt, readString } from "@/lib/webmcp/input";
import { recordToolCall } from "@/lib/webmcp/activity";

/**
 * The TBR toolset.
 *
 * Eight tools, each mapped to a user journey in docs/03-product-spec.md. Every
 * one of them goes through the library store — never localStorage, never React
 * state — so an agent's writes re-render the UI exactly as a person's do. That
 * is the whole reason the changes are visible on screen as they happen.
 *
 * The four that mutate the shelf (`add_book`, `update_book`, `remove_book`,
 * `import_books`) also call `goTo` so the reader is looking at the shelf when
 * it happens, not just told about it in the agent's reply. `navigate_to` is the
 * complementary tool for when the agent wants to point at something without
 * changing it — a search result, a book worth a second look.
 *
 * Schemas, budgets and rationale: docs/04-tool-design.md.
 */

const RATINGS = [1, 2, 3, 4, 5] as const;

function asRating(value: number | undefined): Rating | undefined {
  return RATINGS.find((rating) => rating === value);
}

function shelfSummary(): string {
  const counts = library.counts();
  return `${counts.tbr} to read, ${counts.read} read, ${counts.dnf} abandoned`;
}

// ---------------------------------------------------------------------------
// 1. search_catalog
// ---------------------------------------------------------------------------

const searchCatalogTool: ToolDescriptor = {
  name: "search_catalog",
  description:
    "Search the global book catalogue (Open Library) by title, author, series " +
    "or year. Returns candidates with a catalog_id to pass to add_book. " +
    "Whenever you have identified a book from a photo, a description or your " +
    "own knowledge, resolve it here FIRST, then add it with the catalog_id — " +
    "that is what gives the book its cover art and publication year. Shows the " +
    "matching catalogue search on screen, which is useful when discussing " +
    "several books. Does not read or change the reader's own list.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: 'Free text: title, author, series or year. e.g. "le guin dispossessed"',
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "Maximum results to return. Defaults to 10.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  annotations: {
    readOnlyHint: true,
    // Open Library is a public wiki: any record is editable by anyone, and its
    // text lands verbatim in the agent's context. That makes this an indirect
    // prompt-injection surface, and the hint is a real mitigation.
    untrustedContentHint: true,
  },
  execute: async (args) => {
    const query = readString(args, "query");
    if (!query) {
      return err("A search query is required.", 'Example: {"query": "ursula le guin"}.');
    }

    const limit = readClampedInt(args, "limit", 1, 20, 10);

    try {
      const results = await searchCatalog(query, limit);
      if (results.length === 0) {
        return ok(
          `No catalogue matches for "${query}". Try fewer words, or just the ` +
            `author's surname. You can also call add_book with title and author directly.`,
        );
      }

      const rows = results.map((result) => [
        result.olKey,
        result.title,
        result.author,
        result.year,
      ]);

      // A catalogue query often represents a set — an author's work, a series,
      // or several possible matches. Put that set on screen immediately rather
      // than making the reader infer it from a tool response.
      goTo({ path: `/search?q=${encodeURIComponent(query)}` });

      return ok(
        `Catalogue matches for "${query}":\n` +
          table(["catalog_id", "title", "author", "year"], rows) +
          `\nShowing these matches in catalogue search. Pass a catalog_id to add_book.`,
        results,
      );
    } catch {
      return err(
        "The catalogue is unreachable right now.",
        "Call add_book with title and author instead.",
      );
    }
  },
};

// ---------------------------------------------------------------------------
// 2. search_my_books
// ---------------------------------------------------------------------------

const searchMyBooksTool: ToolDescriptor = {
  name: "search_my_books",
  description:
    "Search the reader's own shelves. Filter by shelf (tbr, read, dnf), by " +
    "title or author text, or by minimum star rating. Every filter is " +
    "optional; with none, it returns the whole library newest first. Returns " +
    "the book_id values that update_book and remove_book need. When the reader " +
    "asks what to read next, call get_taste_profile first, then list the tbr " +
    "shelf with this. When a named-book search identifies what the reader is " +
    "discussing, follow it with navigate_to so that book is on screen.",
  inputSchema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: [...SHELVES],
        description: "Shelf to search: tbr, read or dnf. Omit to search all shelves.",
      },
      query: {
        type: "string",
        description: "Optional title or author substring to filter by.",
      },
      min_rating: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        description: "Only books rated at least this many stars.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 20,
        description: "Maximum results to return. Defaults to 10.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  execute: (args) => {
    const shelf = readEnum<Shelf>(args, "status", SHELVES);
    const text = readString(args, "query");
    const minRating = asRating(readInt(args, "min_rating"));
    const limit = readClampedInt(args, "limit", 1, 20, 10);

    const { results, total } = library.query({ shelf, text, minRating, limit });

    if (total === 0) {
      // An empty result must distinguish "your filter missed" from "the shelf
      // is empty" — the agent cannot tell them apart otherwise.
      return ok(`No books match that filter. Your library holds ${shelfSummary()}.`);
    }

    const rows = results.map((book) => [
      book.id.slice(0, 8),
      book.title,
      book.author,
      book.shelf,
      book.rating ?? "-",
    ]);

    const heading = shelf ? `Books on the ${shelf} shelf` : "Books in the library";
    const footer =
      total > results.length
        ? `\nShowing ${results.length} of ${total}. Narrow with query, status or min_rating.`
        : "";

    // Only on the tbr shelf, and only when the agent is looking at all of it —
    // that is the shape of a "what next?" question, and nowhere else.
    const recommendHint =
      shelf === "tbr" && !text && !minRating
        ? "\nIf you are picking something to read, call get_taste_profile first " +
          "if you have not already. After choosing ONE book from these results, " +
          'call navigate_to with {"view":"book","book_id":"…"} BEFORE ' +
          "replying, so the reader can see the recommendation."
        : "";

    // A named-book lookup usually means the reader is talking about that book,
    // even if there is nothing left to update. Surface the exact result rather
    // than leaving them on whichever page happened to be open.
    const discussionHint =
      text && results.length === 1
        ? `\nThe reader is discussing "${results[0].title}". Call navigate_to ` +
          `with view=book and book_id="${results[0].id}" before replying, even ` +
          "if its shelf or rating already matches what they said."
        : "";

    return ok(
      `${heading} (${total}):\n` +
        table(["book_id", "title", "author", "shelf", "rating"], rows) +
        footer +
        recommendHint +
        discussionHint,
      results,
    );
  },
};

// ---------------------------------------------------------------------------
// 3. get_taste_profile  — the centrepiece
// ---------------------------------------------------------------------------

function renderTasteProfile(profile: TasteProfile): string {
  if (profile.sparse) {
    return (
      `Not enough history yet — ${profile.counts.read} read, ` +
      `${profile.totalRated} rated. Recommend from the tbr shelf directly and ` +
      `ask the reader what they are in the mood for.`
    );
  }

  const lines: string[] = ["READING PROFILE"];

  lines.push(
    `Shelves: ${profile.counts.tbr} to read, ${profile.counts.read} read, ` +
      `${profile.counts.dnf} abandoned. Average rating ${profile.averageRating?.toFixed(1)} ` +
      `across ${profile.totalRated} rated.`,
  );

  if (profile.loved.length > 0) {
    lines.push(
      "Loved: " +
        profile.loved
          .map((a) => `${a.author} (${a.count} books, avg ${a.averageRating})`)
          .join(", "),
    );
  }

  if (profile.disliked.length > 0) {
    lines.push(
      "Disliked or abandoned: " +
        profile.disliked
          .map((a) => {
            // An average alone misreads: an author with one 3-star book and one
            // abandonment is not a 3-star author to this reader.
            const parts = [`${a.count} book${a.count === 1 ? "" : "s"}`];
            if (a.abandoned > 0) parts.push(`${a.abandoned} abandoned`);
            if (a.averageRating) parts.push(`avg ${a.averageRating.toFixed(1)}`);
            return `${a.author} (${parts.join(", ")})`;
          })
          .join(", "),
    );
  }

  if (profile.eras.length > 0) {
    lines.push("Eras: " + profile.eras.map((e) => `${e.decade}s ${e.share}%`).join(", "));
  }

  if (profile.finishingRate !== null) {
    lines.push(`Finishing rate: ${profile.finishingRate}% of books started.`);
  }

  if (profile.recentlyFinished.length > 0) {
    lines.push(
      "Recently finished: " +
        profile.recentlyFinished
          .map((b) => `${b.title}${b.rating ? ` (${b.rating}*)` : ""}`)
          .join(", "),
    );
  }

  if (profile.signal) lines.push(`Signal: ${profile.signal}`);

  /*
   * The happy path, delivered at the moment it is relevant.
   *
   * WebMCP has no prompts or resources primitive — `provideContext` takes tools
   * and nothing else — so tool output is the only place to steer a multi-step
   * workflow without spending description budget on every call. This is the
   * flagship journey: profile, then shelf, then one considered recommendation
   * shown on screen. The final navigation is a separate tool call because a
   * recommendation must not silently change the reader's library.
   */
  lines.push(
    "Next: call search_my_books with status=tbr, choose ONE book from that " +
      "shelf, then call navigate_to with view=book and its book_id BEFORE " +
      "replying. Say briefly why it fits this profile.",
  );

  return lines.join("\n");
}

const tasteProfileTool: ToolDescriptor = {
  name: "get_taste_profile",
  description:
    "Get a compact summary of the reader's taste, computed from their whole " +
    "rating and reading history: favourite authors, authors they abandon, " +
    "rating patterns, era preferences and finishing rate. Call this FIRST " +
    "whenever the reader asks what to read next, what they would like, or " +
    "anything about their reading habits — before searching their shelves — so " +
    "the answer reflects what they actually enjoy rather than what merely " +
    "happens to be on the list.",
  inputSchema: { type: "object", properties: {}, required: [], additionalProperties: false },
  annotations: { readOnlyHint: true },
  execute: () => {
    const profile = library.profile();
    return ok(renderTasteProfile(profile), profile);
  },
};

// ---------------------------------------------------------------------------
// 4. add_book
// ---------------------------------------------------------------------------

const addBookTool: ToolDescriptor = {
  name: "add_book",
  description:
    "Add a book to the reader's list. Pass catalog_id from search_catalog for " +
    "a full record with cover art, or pass title and author directly when the " +
    "catalogue has no good match. Defaults to the tbr shelf. Safe to call " +
    "repeatedly: adding several books in a row — from one photo of a shelf, " +
    "say — is a normal flow, and a book already on a shelf is skipped rather " +
    "than duplicated.",
  inputSchema: {
    type: "object",
    properties: {
      catalog_id: {
        type: "string",
        description: 'Open Library id from search_catalog, e.g. "OL59863W". Preferred.',
      },
      title: { type: "string", description: "Book title. Use when there is no catalog_id." },
      author: { type: "string", description: "Author name. Use when there is no catalog_id." },
      status: {
        type: "string",
        enum: [...SHELVES],
        description: "Shelf to add to: tbr, read or dnf. Defaults to tbr.",
      },
      note: { type: "string", description: "Optional short note on why it was added." },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (args) => {
    const catalogId = readString(args, "catalog_id");
    const title = readString(args, "title");
    const author = readString(args, "author");
    const shelf = readEnum<Shelf>(args, "status", SHELVES) ?? "tbr";
    const note = readString(args, "note");

    let record: { title: string; author: string; year?: number; coverId?: number; olKey?: string };

    if (catalogId) {
      // Resolve the id back to a full record so the card gets cover art. This
      // must go through `lookupByKey`: a bare key in a plain search returns
      // nothing, and falling back would shelve a book titled "OL59863W".
      const match = await lookupByKey(catalogId).catch(() => null);
      record = match
        ? { ...match }
        : { title: title ?? catalogId, author: author ?? "Unknown", olKey: catalogId };
    } else if (title) {
      const [match] = await searchCatalog(`${title} ${author ?? ""}`, 1).catch(() => []);
      const trustMatch =
        match && match.title.toLowerCase().includes(title.toLowerCase().slice(0, 12));
      record = trustMatch ? { ...match } : { title, author: author ?? "Unknown" };
    } else {
      return err(
        "Need either catalog_id, or a title.",
        "Call search_catalog first to get a catalog_id.",
      );
    }

    const { book, duplicate } = library.add({ ...record, shelf, note });

    if (duplicate) {
      recordToolCall("add_book", `${book.title} — already on shelf`);
      // The add request still identifies the book being discussed. Bring it
      // forward rather than treating a harmless duplicate as a dead end.
      goTo({ path: `/book?id=${encodeURIComponent(book.id)}` });
      return ok(
        `"${book.title}" is already on your ${book.shelf} shelf. No change made; ` +
          "showing its book page.",
        book,
      );
    }

    recordToolCall("add_book", `Added ${book.title}`);
    notify({ message: `Added “${book.title}” to ${book.shelf}.`, source: "agent" });
    // Bulk additions stay on the shelf, but navigate to the appropriate shelf
    // and re-touch this card so the reader sees exactly what changed.
    goTo({ path: "/", shelf, highlightIds: [book.id] });

    return ok(
      `Added "${book.title}" by ${book.author} to your ${shelf} shelf. ` +
        `Showing it on that shelf. If you are working through several books, add the next one now.`,
      book,
    );
  },
};

// ---------------------------------------------------------------------------
// 5. update_book
// ---------------------------------------------------------------------------

const updateBookTool: ToolDescriptor = {
  name: "update_book",
  description:
    "Change a book already on the list: move it between shelves, set a star " +
    "rating, or replace its note. Any field left out is unchanged. When the " +
    "reader says they finished a book or gave up on one, call search_my_books " +
    "to find its book_id, then set the shelf and the rating here in a single " +
    "call. A successful update automatically shows that book to the reader.",
  inputSchema: {
    type: "object",
    properties: {
      book_id: { type: "string", description: "Book id from search_my_books. Required." },
      status: {
        type: "string",
        enum: [...SHELVES],
        description: "New shelf: tbr, read or dnf. Omit to leave the shelf unchanged.",
      },
      rating: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        description: "Star rating from 1 to 5. Omit to leave the rating unchanged.",
      },
      note: { type: "string", description: "Replacement note. Omit to leave the note unchanged." },
    },
    required: ["book_id"],
    additionalProperties: false,
  },
  execute: (args) => {
    const bookId = readString(args, "book_id");
    if (!bookId) {
      return err("book_id is required.", "Call search_my_books to get current ids.");
    }

    // Ids are shown truncated to eight characters to save output budget, so
    // accept either form on the way back in.
    const target = library.all().find((book) => book.id === bookId || book.id.startsWith(bookId));
    if (!target) {
      return err(`No book with id "${bookId}".`, "Call search_my_books to get current ids.");
    }

    const shelf = readEnum<Shelf>(args, "status", SHELVES);
    const rating = asRating(readInt(args, "rating"));
    const note = readString(args, "note");

    if (!shelf && !rating && !note) {
      return err(
        `Nothing to change on "${target.title}".`,
        "Pass status, rating or note.",
      );
    }

    const updated = library.update(target.id, { shelf, rating, note });
    if (!updated) {
      return err(`"${target.title}" could not be updated.`, "Call search_my_books to re-check.");
    }

    const changes = [
      shelf ? `moved to ${shelf}` : null,
      rating ? `rated ${rating}*` : null,
      note ? "note updated" : null,
    ].filter(Boolean);

    recordToolCall("update_book", `${updated.title} — ${changes.join(", ")}`);
    notify({ message: `“${updated.title}” ${changes.join(", ")}.`, source: "agent" });
    goTo({ path: `/book?id=${encodeURIComponent(updated.id)}` });

    return ok(`"${updated.title}": ${changes.join(", ")}. Showing its book page.`, updated);
  },
};

// ---------------------------------------------------------------------------
// 6. remove_book  — the human-in-the-loop showcase
// ---------------------------------------------------------------------------

const removeBookTool: ToolDescriptor = {
  name: "remove_book",
  description:
    "Permanently remove a book from the reader's list. This cannot be undone " +
    "by the agent, and the reader is asked to confirm before it happens. Use " +
    "update_book instead if they merely want it on a different shelf.",
  inputSchema: {
    type: "object",
    properties: {
      book_id: { type: "string", description: "Book id from search_my_books. Required." },
    },
    required: ["book_id"],
    additionalProperties: false,
  },
  annotations: { destructiveHint: true },
  execute: async (args: ToolArgs, agent?: AgentHandle): Promise<ToolResponse> => {
    const bookId = readString(args, "book_id");
    if (!bookId) {
      return err("book_id is required.", "Call search_my_books to get current ids.");
    }

    const target = library.all().find((book) => book.id === bookId || book.id.startsWith(bookId));
    if (!target) {
      return err(`No book with id "${bookId}".`, "Call search_my_books to get current ids.");
    }

    const askReader = () =>
      requestConfirmation({
        title: `Remove “${target.title}”?`,
        body: `${target.author}. This deletes it from your list permanently.`,
        confirmLabel: "Remove it",
        source: "agent",
      });

    /*
     * `requestUserInteraction` is the spec's mechanism for blocking a tool call
     * on a real human decision. It is not present in every host, so:
     *
     *   - if the host provides it, we go through it (the correct path);
     *   - if it does not, we still ask, using our own dialog directly.
     *
     * Either way the reader is asked. What we never do is delete silently
     * because a capability was missing.
     */
    const confirmed = agent?.requestUserInteraction
      ? await agent.requestUserInteraction(askReader)
      : await askReader();

    if (confirmed === false) {
      recordToolCall("remove_book", `${target.title} — reader declined`, true);
      return err(
        `The reader declined. "${target.title}" is still on their ${target.shelf} shelf.`,
      );
    }

    const removed = library.remove(target.id);
    if (!removed) return err(`"${target.title}" was already gone.`);

    recordToolCall("remove_book", `Removed ${removed.title}`);
    notify({
      message: `Removed “${removed.title}”.`,
      source: "agent",
      action: { label: "Undo", run: () => library.restore(removed) },
    });
    // Matches the manual remove flow in book/page.tsx: if the reader was on
    // this book's own page, that page no longer resolves to anything.
    goTo({ path: "/" });

    return ok(`Removed "${removed.title}" from the list.`);
  },
};

// ---------------------------------------------------------------------------
// 7. import_books
// ---------------------------------------------------------------------------

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

/** Shared by the tool and the paste-a-CSV panel, so both behave identically. */
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

const importBooksTool: ToolDescriptor = {
  name: "import_books",
  description:
    "Bulk-import a reading list from Goodreads-style CSV text. Reads the " +
    "Title, Author, Exclusive Shelf and My Rating columns and ignores the " +
    "rest. Returns a summary only, never the full list. Existing books are " +
    "skipped rather than duplicated.",
  inputSchema: {
    type: "object",
    properties: {
      csv: {
        type: "string",
        description: "CSV text including a header row with at least a Title column.",
      },
    },
    required: ["csv"],
    additionalProperties: false,
  },
  execute: (args) => {
    const csv = readString(args, "csv");
    if (!csv) return err("CSV text is required.", "Include a header row with a Title column.");

    const { added, duplicates, skipped } = importGoodreadsCsv(csv);

    if (added === 0 && duplicates === 0) {
      return err(
        "Nothing could be imported.",
        "Check the CSV has a header row with a Title column.",
      );
    }

    recordToolCall("import_books", `Imported ${added} books`);
    notify({ message: `Imported ${added} books.`, source: "agent" });
    goTo({ path: "/" });

    // A 200-book import cannot list what it imported — summarise, always.
    return ok(
      `Imported ${added} books. Skipped ${duplicates} already on your list` +
        `${skipped > 0 ? ` and ${skipped} rows with no title` : ""}. ` +
        `Your library now holds ${shelfSummary()}.`,
    );
  },
};

// ---------------------------------------------------------------------------
// 8. navigate_to
// ---------------------------------------------------------------------------

const NAV_VIEWS = ["shelf", "book", "taste", "search"] as const;
type NavView = (typeof NAV_VIEWS)[number];

const navigateTool: ToolDescriptor = {
  name: "navigate_to",
  description:
    "Change what the reader is looking at — this never changes their data. " +
    "When a specific book is recommended or discussed, call this as your FINAL " +
    "tool call before replying, using view=book and that book_id, so the reader " +
    'sees it rather than only hearing about it. view="book" opens one book (book_id or ' +
    'catalog_id); "shelf" shows the library, optionally filtered and ' +
    'highlighting a book_id; "taste" opens the reading profile; "search" ' +
    "opens catalogue search, optionally pre-filled with query.",
  inputSchema: {
    type: "object",
    properties: {
      view: {
        type: "string",
        enum: [...NAV_VIEWS],
        description: 'Screen to show: "shelf", "book", "taste" or "search".',
      },
      book_id: {
        type: "string",
        description:
          "A book_id from search_my_books, or a catalog_id from search_catalog. " +
          'Required when view is "book". On "shelf", highlights this book if it ' +
          "is on a shelf.",
      },
      shelf: {
        type: "string",
        enum: [...SHELVES],
        description: 'Filter the shelf to one shelf. Only used when view is "shelf".',
      },
      query: {
        type: "string",
        description: 'Pre-fill the search box. Only used when view is "search".',
      },
    },
    required: ["view"],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: true },
  execute: (args) => {
    const view = readEnum<NavView>(args, "view", NAV_VIEWS);
    if (!view) {
      return err(
        'view is required: "shelf", "book", "taste" or "search".',
        'Example: {"view": "shelf", "book_id": "a3f1"}.',
      );
    }

    const bookId = readString(args, "book_id");
    const shelfFilter = readEnum<Shelf>(args, "shelf", SHELVES);
    const query = readString(args, "query");

    if (view === "book") {
      if (!bookId) {
        return err(
          'book_id is required when view is "book".',
          "Call search_my_books or search_catalog first.",
        );
      }
      goTo({ path: `/book?id=${encodeURIComponent(bookId)}` });
      return ok(`Showing the book page for "${bookId}".`);
    }

    if (view === "taste") {
      goTo({ path: "/taste" });
      return ok("Showing the reading profile.");
    }

    if (view === "search") {
      goTo({ path: query ? `/search?q=${encodeURIComponent(query)}` : "/search" });
      return ok(query ? `Showing the search page for "${query}".` : "Showing the search page.");
    }

    // view === "shelf"
    const target = bookId
      ? library.all().find((book) => book.id === bookId || book.id.startsWith(bookId))
      : undefined;
    if (bookId && !target) {
      return err(
        `No book with id "${bookId}" on the shelf.`,
        'Call search_my_books for current ids, or use view="book" for a catalogue-only book.',
      );
    }

    // An explicit shelf filter is honoured even if it hides the target — that
    // is what the agent asked for. Otherwise, a highlighted book must stay
    // visible, so any existing filter is cleared rather than left to hide it.
    goTo({
      path: "/",
      shelf: shelfFilter ?? (target ? null : undefined),
      highlightIds: target ? [target.id] : undefined,
    });

    return ok(
      [
        `Showing the shelf${shelfFilter ? ` filtered to ${shelfFilter}` : ""}.`,
        target ? `Highlighted "${target.title}".` : null,
      ]
        .filter(Boolean)
        .join(" "),
    );
  },
};

/**
 * Every tool call is logged for the on-screen activity panel. Wrapping here
 * rather than inside each handler means no tool can forget to do it, and read
 * tools get the same treatment as writes.
 */
function withActivityLog(tool: ToolDescriptor): ToolDescriptor {
  const alreadyLogs = new Set(["add_book", "update_book", "remove_book", "import_books"]);

  return {
    ...tool,
    execute: async (args, agent) => {
      const response = await tool.execute(args, agent);
      if (!alreadyLogs.has(tool.name)) {
        const summary = response.content[0]?.text.split("\n")[0] ?? "";
        recordToolCall(tool.name, summary.slice(0, 80), response.isError === true);
      }
      return response;
    },
  };
}

export const tools: ToolDescriptor[] = [
  searchCatalogTool,
  searchMyBooksTool,
  tasteProfileTool,
  addBookTool,
  updateBookTool,
  removeBookTool,
  importBooksTool,
  navigateTool,
].map(withActivityLog);
