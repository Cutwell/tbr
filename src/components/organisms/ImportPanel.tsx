"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { notify } from "@/lib/store/notifications";
import { importGoodreadsCsv } from "@/lib/webmcp/tools";

const SAMPLE = `Title,Author,Exclusive Shelf,My Rating
The Wall,Marlen Haushofer,to-read,0
Stoner,John Williams,read,5`;

/**
 * Goodreads CSV import.
 *
 * A paste box rather than file upload with column mapping. Goodreads exports
 * CSV, readers can paste it, and the full upload flow would cost half a day for
 * a journey that is a single step. It shares `importGoodreadsCsv` with the
 * `import_books` tool, so a person and an agent get identical behaviour.
 */
export function ImportPanel({ onDone }: { onDone: () => void }) {
  const [csv, setCsv] = useState("");

  function run() {
    const { added, duplicates, skipped } = importGoodreadsCsv(csv);

    if (added === 0 && duplicates === 0) {
      notify({ message: "Nothing imported — check there is a Title column." });
      return;
    }

    notify({
      message:
        `Imported ${added} book${added === 1 ? "" : "s"}` +
        (duplicates > 0 ? `, skipped ${duplicates} already here` : "") +
        (skipped > 0 ? `, ${skipped} rows had no title` : "") +
        ".",
    });

    setCsv("");
    onDone();
  }

  return (
    <section className="animate-rise border border-rule bg-paper-raised p-6 md:p-8">
      <h2 className="font-display text-2xl text-ink">Import a reading list</h2>
      <p className="mt-1.5 max-w-prose text-sm text-pretty text-ink-soft">
        Paste a Goodreads CSV export. TBR reads the Title, Author, Exclusive
        Shelf and My Rating columns and ignores everything else. Books already
        on your shelves are skipped, not duplicated.
      </p>

      <textarea
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        rows={7}
        spellCheck={false}
        placeholder={SAMPLE}
        aria-label="Goodreads CSV"
        className="mt-5 w-full resize-y border border-rule bg-paper p-3 font-mono text-[0.75rem] leading-relaxed text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />

      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={run} disabled={csv.trim().length === 0}>
          <Icon name="upload" size={15} />
          Import
        </Button>
        <p className="u-meta text-ink-faint">
          Your agent can do this too — <span className="text-ink-soft">import_books</span>
        </p>
      </div>
    </section>
  );
}
