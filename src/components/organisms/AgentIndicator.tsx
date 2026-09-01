"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/atoms/Icon";
import { tools } from "@/lib/webmcp/tools";
import { useToolActivity } from "@/lib/webmcp/activity";
import { useWebMCPStatus } from "@/lib/webmcp/register";
import { cn } from "@/lib/utils/cn";

/**
 * Agent status, deliberately quiet.
 *
 * TBR is a reading list first; WebMCP is something it also happens to offer.
 * So this is a dot and a word in the header, not a panel competing with the
 * books — the detail is one click away for anyone who wants it, and invisible
 * to everyone who does not.
 *
 * Agent activity stays legible without this being open: tool calls raise
 * toasts, changed books pulse on the shelf, and the dot itself pulses on each
 * call. The popover is for people who want to know *how*, not *whether*.
 */

const SUGGESTED_PROMPTS = [
  "What should I read next?",
  "Here's a photo of my shelf — add these to my list",
  "I finished Piranesi, five stars",
  "Take Cryptonomicon off my list — I'm not going to finish it",
  "Import my Goodreads export",
] as const;

/**
 * Short, human-facing gloss per tool — deliberately distinct copy from the
 * agent-facing `description` in tools.ts, which is written for a model
 * reasoning about when to call it, not a reader scanning a list in one pass.
 */
const TOOL_BLURBS: Record<string, string> = {
  search_catalog: "Search Open Library for a book.",
  search_my_books: "Search your own shelves.",
  get_taste_profile: "Summarize what you tend to enjoy.",
  add_book: "Add a book to your list.",
  update_book: "Change a shelf or rating.",
  remove_book: "Remove a book — asks first.",
  import_books: "Bulk-import a Goodreads CSV.",
  navigate_to: "Show you something on screen.",
};

function relativeTime(at: number): string {
  const seconds = Math.round((Date.now() - at) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export function AgentIndicator() {
  const status = useWebMCPStatus();
  const activity = useToolActivity();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  if (status.state === "pending") return null;

  const ready = status.state === "ready";
  // `ready` now also covers a polyfilled context (see adapter.ts) — tools are
  // registered and locally callable, but no external agent is confirmed to be
  // watching. `confirmed` is the stronger claim the UI reserves for a genuine
  // host, so it never overstates what a plain, unmodified browser can do.
  const polyfilled = ready && status.polyfilled;
  const confirmed = ready && !status.polyfilled;
  const names = ready ? status.toolNames : tools.map((tool) => tool.name);
  const lastCall = activity[0];

  const troubleshooting = (
    <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-4 text-[0.8125rem] leading-snug text-ink-soft marker:text-ink-faint">
      <li>ChatGPT: Browser settings → Permissions → Enable site tools.</li>
      <li>
        Use GPT-5.6 Sol or Terra — Luna has WebMCP disabled, and site tools are
        off in Enterprise and Edu workspaces.
      </li>
      <li>
        Chrome:{" "}
        <code className="bg-paper-sunk px-1 py-px font-mono text-[0.7rem]">
          chrome://flags/#enable-webmcp-testing
        </code>
      </li>
    </ul>
  );

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          confirmed
            ? `Agent connected, ${names.length} tools`
            : polyfilled
              ? `${names.length} tools registered, no agent confirmed`
              : "Agent not connected"
        }
        className={cn(
          "u-meta inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1.5",
          "transition-colors duration-150",
          open
            ? "border-rule-strong bg-paper-sunk text-ink"
            : "border-transparent text-ink-faint hover:border-rule hover:text-ink-soft",
        )}
      >
        <span
          key={lastCall?.id}
          className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            confirmed ? "bg-accent" : "bg-ink-faint",
            // Re-keyed on each call, so the animation replays every time.
            ready && lastCall && "animate-pulse-once",
          )}
        />
        <span className={cn(status.state === "unsupported" && "line-through")}>
          Agent
        </span>
      </button>

      {open && (
        <div
          className={cn(
            "animate-rise absolute top-full right-0 z-40 mt-2 w-[min(21rem,calc(100vw-2.5rem))]",
            "border border-rule bg-paper-raised p-4 text-left shadow-[var(--shadow-lg)]",
          )}
        >
          <div className="flex items-center gap-2">
            <Icon name="sparkle" size={14} className={confirmed ? "text-accent" : "text-ink-faint"} />
            <h2 className="u-meta text-ink">
              {confirmed
                ? `${names.length} tools live`
                : polyfilled
                  ? `${names.length} tools registered`
                  : "Not connected"}
            </h2>
          </div>

          {confirmed && (
            <>
              <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-ink-soft">
                Your agent can search these shelves, learn your taste and add
                books. Try asking:
              </p>
              <ul className="mt-2.5 flex flex-col gap-1.5">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <li
                    key={prompt}
                    className="border-l border-rule pl-2.5 text-[0.8125rem] leading-snug text-pretty text-ink-soft"
                  >
                    “{prompt}”
                  </li>
                ))}
              </ul>
            </>
          )}

          {polyfilled && (
            <>
              <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-pretty text-ink-soft">
                This browser doesn&apos;t natively support WebMCP, so these
                tools are only registered locally — nothing has confirmed an
                agent is watching yet.
              </p>
              {troubleshooting}
            </>
          )}

          {!ready && (
            <>
              <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-pretty text-ink-soft">
                This browser did not expose a WebMCP host, so an agent can only
                read the page. Everything here works by hand regardless.
              </p>
              {troubleshooting}
            </>
          )}

          <ul className="mt-4 flex flex-col gap-1.5 border-t border-rule pt-3">
            {names.map((name) => (
              <li key={name} className="flex flex-col gap-0.5">
                <span className="font-mono text-[0.7rem] text-ink-faint">{name}</span>
                {TOOL_BLURBS[name] && (
                  <span className="text-[0.75rem] leading-snug text-ink-soft">
                    {TOOL_BLURBS[name]}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {ready && (
            <p className="mt-3 border-t border-rule pt-3 text-[0.75rem] leading-relaxed text-ink-faint">
              Runs entirely in this browser — your list lives in localStorage;
              only Open Library ever sees a network request.
            </p>
          )}

          {activity.length > 0 && (
            <ol className="mt-3 flex flex-col gap-1.5 border-t border-rule pt-3">
              {activity.slice(0, 4).map((record) => (
                <li key={record.id} className="flex items-baseline gap-2 text-[0.8125rem]">
                  <span
                    className={cn(
                      "u-meta shrink-0",
                      record.failed ? "text-shelf-dnf" : "text-accent",
                    )}
                  >
                    {record.tool}
                  </span>
                  <span className="flex-1 truncate text-ink-soft" title={record.summary}>
                    {record.summary}
                  </span>
                  <span className="u-meta shrink-0 text-ink-faint">
                    {relativeTime(record.at)}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {ready && (
            <p className="u-meta mt-3 text-ink-faint">
              via {status.namespace}.modelContext · {status.mode}
              {polyfilled ? " · polyfilled" : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
