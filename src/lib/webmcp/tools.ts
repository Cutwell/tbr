import { lookupByKey, searchCatalog } from "@/lib/catalog/openlibrary";
import { requestConfirmation } from "@/lib/store/confirmations";
import { goTo } from "@/lib/store/navigation";
import { notify } from "@/lib/store/notifications";
import { library } from "@/lib/store/store";
import { asRating, SHELVES, type Shelf, type TasteProfile } from "@/lib/types";
import { isIsoDate, today } from "@/lib/utils/date";
import type { AgentHandle, ToolArgs, ToolDescriptor, ToolResponse } from "@/lib/webmcp/adapter";
import { err, ok, table } from "@/lib/webmcp/format";
import { readClampedInt, readEnum, readInt, readString } from "@/lib/webmcp/input";
import { recordToolCall } from "@/lib/webmcp/activity";

/**
 * The TBR toolset.
 *
 * Seven tools, each mapped to a user journey in docs/product-spec.md. Every
 * one of them goes through the library store — never localStorage, never React
 * state — so an agent's writes re-render the UI exactly as a person's do. That
 * is the whole reason the changes are visible on screen as they happen.
 *
 * The three that mutate the shelf (`add_book`, `update_book`, `remove_book`)
 * also call `goTo` so the reader is looking at the shelf when it happens, not
 * just told about it in the agent's reply. `navigate_to` is the complementary
 * tool for when the agent wants to point at something without changing it — a
 * search result, a book worth a second look.
 *
 * Goodreads CSV import is deliberately not a tool. It is a first-class UI path
 * instead — see `store/goodreads.ts` and `ImportPanel`.
 *
 * Schemas, budgets and rationale: docs/tool-design.md.
 */

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
    // The one genuinely open world in the toolset, alongside add_book.
    openWorldHint: true,
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
  annotations: { readOnlyHint: true, openWorldHint: false },
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
  annotations: { readOnlyHint: true, openWorldHint: false },
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
  annotations: {
    // Additive in the strict sense the spec means: it only ever puts a book on
    // a shelf. A book already there is reported and left exactly as it was —
    // nothing is overwritten and nothing is removed.
    destructiveHint: false,
    // Follows from that dedupe. A second identical call finds the duplicate and
    // changes nothing, so repeated calls leave the library in one state.
    idempotentHint: true,
    // Resolves catalog_id against Open Library, so this genuinely is open-world.
    openWorldHint: true,
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
    "call. Rating a book that is still on tbr moves it to read on its own, so " +
    "there is no need to pass status as well — pass status only when the shelf " +
    "differs from that, such as rating a book the reader abandoned. Moving to " +
    "read or dnf records today as the date it ended; pass finished_on when the " +
    "reader names a different day. A successful update automatically shows " +
    "that book to the reader.",
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
        description:
          "Star rating from 1 to 5. Omit to leave the rating unchanged. " +
          "Rating a book that is on tbr also moves it to the read shelf.",
      },
      note: { type: "string", description: "Replacement note. Omit to leave the note unchanged." },
      finished_on: {
        type: "string",
        format: "date",
        pattern: "^\\d{4}-\\d{2}-\\d{2}$",
        description:
          "Day it was finished or abandoned, as YYYY-MM-DD (e.g. 2026-03-12). " +
          "Defaults to today. Not valid on tbr; cannot be in the future.",
      },
    },
    required: ["book_id"],
    additionalProperties: false,
  },
  annotations: {
    /*
     * Deliberately `true`, and worth stating why, because `false` is the
     * tempting answer.
     *
     * The spec's bar for `destructiveHint: false` is that a tool "performs
     * only additive updates" — not that it is harmless, or reversible, or
     * well-intentioned. This tool *replaces* a shelf, a rating, a note or a
     * finish date, and the previous value is gone. That is not additive, so
     * claiming otherwise would be false, and false in the direction that
     * flatters: picking the annotation that attracts less scrutiny over the
     * one that is true.
     *
     * It is the right call on the merits too. An agent that wrongly moves a
     * book to `dnf` and rates it 1 has overwritten the reader's own judgment
     * of a book they read, which deserves more scrutiny than adding one does.
     *
     * No confirmation dialog, though: rating a book is the single most common
     * thing a reader asks an agent to do, and a prompt on every star would
     * make J5 worse than doing it by hand. The properties that would justify
     * one are all absent — it touches one named book, through a closed set of
     * fields, with a bounded payload and no content crossing in from another
     * origin.
     */
    destructiveHint: true,
    // Setting the same fields to the same values twice lands in one state.
    idempotentHint: true,
    openWorldHint: false,
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
    const finishedOn = readString(args, "finished_on");

    if (!shelf && !rating && !note && !finishedOn) {
      return err(
        `Nothing to change on "${target.title}".`,
        "Pass status, rating, note or finished_on.",
      );
    }

    /*
     * `finished_on` is validated here rather than left to the store, because
     * the store's job is to apply a patch and a tool's job is to hand the agent
     * a correctable error. All three checks are recoverable in one retry, so
     * each names the fix.
     *
     * Omitting it is the common path and stays automatic: the store stamps
     * today on a move into read or dnf. This parameter exists only for the case
     * that automation cannot serve — "I finished it last Tuesday".
     */
    if (finishedOn) {
      if (!isIsoDate(finishedOn)) {
        return err(
          `"${finishedOn}" is not a date finished_on accepts.`,
          "Use YYYY-MM-DD, for example 2026-03-12.",
        );
      }

      // Both sides are validated `YYYY-MM-DD`, so a string compare is a date
      // compare — no parsing, and no timezone to get wrong.
      if (finishedOn > today()) {
        return err(
          `finished_on is in the future: today is ${today()}.`,
          "Give a day on or before today, or omit it to use today.",
        );
      }

      // A book the reader still intends to read has no end date, and the store
      // clears the field on any move to tbr — so accepting one here would write
      // a value that the same call immediately contradicts.
      //
      // A rating counts towards where the book ends up: rating a tbr book moves
      // it to read (store.ts), which makes "I finished this last Tuesday, four
      // stars" a legal single call rather than an error telling the agent to
      // state a shelf it has already implied.
      const endsOn = shelf ?? (rating && target.shelf === "tbr" ? "read" : target.shelf);
      if (endsOn === "tbr") {
        return err(
          `"${target.title}" would end up on the tbr shelf, which has no finish date.`,
          'Pass status "read" or "dnf" alongside finished_on.',
        );
      }
    }

    const updated = library.update(target.id, { shelf, rating, note, endedAt: finishedOn });
    if (!updated) {
      return err(`"${target.title}" could not be updated.`, "Call search_my_books to re-check.");
    }

    const changes = [
      // Read off the result rather than the request, because the shelf can move
      // without being asked for: rating a tbr book promotes it to read. An
      // agent told only "rated 4*" while the shelf changed underneath it will
      // go on to "correct" something that was already right.
      updated.shelf !== target.shelf ? `moved to ${updated.shelf}` : null,
      rating ? `rated ${rating}*` : null,
      note ? "note updated" : null,
      // Reported only when the agent set it. The automatic stamp is not a
      // change the agent asked for, and echoing it back as one invites a
      // follow-up call to "correct" a date that was already right.
      finishedOn ? `${updated.shelf === "dnf" ? "gave up" : "finished"} ${finishedOn}` : null,
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
  annotations: {
    destructiveHint: true,
    // Removing the same book twice leaves the library where the first call put
    // it; the second merely reports that the id is gone.
    idempotentHint: true,
    openWorldHint: false,
  },
  execute: async (args: ToolArgs, agent?: AgentHandle): Promise<ToolResponse> => {
    const bookId = readString(args, "book_id");
    if (!bookId) {
      return err("book_id is required.", "Call search_my_books to get current ids.");
    }

    const target = library.all().find((book) => book.id === bookId || book.id.startsWith(bookId));
    if (!target) {
      return err(`No book with id "${bookId}".`, "Call search_my_books to get current ids.");
    }

    let dialogPromise: Promise<boolean> | undefined;
    const askReader = () => {
      // A host can invoke this callback and then fail. Reuse its promise in
      // the fallback rather than opening a second competing dialog.
      dialogPromise ??= requestConfirmation({
        title: `Remove “${target.title}”?`,
        body: `${target.author}. This deletes it from your list permanently.`,
        confirmLabel: "Remove it",
        source: "agent",
      });
      return dialogPromise;
    };

    /*
     * `requestUserInteraction` is the spec's mechanism for blocking a tool call
     * on a real human decision. It is not present in every host, so:
     *
     *   - if the host provides and supports it, we go through it;
     *   - if it is absent or throws (as the Codex shim does), we still ask,
     *     using our own dialog directly.
     *
     * Either way the reader is asked. What we never do is delete silently
     * because a capability was missing.
     */
    let confirmed: boolean;
    if (!agent?.requestUserInteraction) {
      confirmed = await askReader();
    } else {
      try {
        confirmed = await agent.requestUserInteraction(askReader);
      } catch {
        // Some hosts expose a method that rejects with "unsupported" instead
        // of omitting it. Capability presence alone is not a capability check.
        confirmed = await askReader();
      }
    }

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
// 7. navigate_to
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
  annotations: { readOnlyHint: true, openWorldHint: false },
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
  const alreadyLogs = new Set(["add_book", "update_book", "remove_book"]);

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
  navigateTool,
].map(withActivityLog);
