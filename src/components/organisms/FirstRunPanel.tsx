"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonStyles } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import type { IconName } from "@/components/atoms/Icon";
import { notify } from "@/lib/store/notifications";
import { library } from "@/lib/store/store";
import { useWebMCPStatus } from "@/lib/webmcp/register";

/**
 * What stands where the books would be, before there are any.
 *
 * TBR seeds nothing now (see `store.hydrate`), so this is the first thing a
 * new reader sees and it has to carry real weight: four genuine ways in, not
 * an apology for an empty grid. The demo library sits among them as one
 * choice rather than being applied to the reader's shelf unasked.
 *
 * The order is deliberate — the two routes that put *their own* books on the
 * shelf come first, and the demo is last, because a reader who loads eighty
 * books they have never read has not started using the app.
 */

interface RouteProps {
  icon: IconName;
  title: string;
  children: ReactNode;
  action: ReactNode;
}

function Route({ icon, title, children, action }: RouteProps) {
  return (
    <div className="flex flex-col items-start gap-2 border border-rule bg-paper-raised p-6">
      <span className="flex items-center gap-2 text-accent">
        <Icon name={icon} size={16} />
      </span>
      <h3 className="font-display text-xl leading-tight text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-pretty text-ink-soft">{children}</p>
      <div className="mt-3">{action}</div>
    </div>
  );
}

export function FirstRunPanel() {
  const status = useWebMCPStatus();

  // A real host, not the local polyfill — the polyfill registers tools that no
  // outside agent can see, so promising an agent there would be a lie.
  const agentReady = status.state === "ready" && !status.polyfilled;

  function handleDemo() {
    const count = library.loadDemo();
    notify({ message: `Loaded ${count} example books. Run resetList() to clear them.` });
  }

  return (
    <div className="col-span-full animate-rise">
      <div className="border border-dashed border-rule px-6 py-12 text-center md:py-16">
        <h2 className="font-display text-3xl text-ink">Your shelf is empty</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-pretty text-ink-soft">
          Nothing here is pre-filled — this list is yours from the first book.
          There are four ways to start.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Route
          icon="search"
          title="Search the catalogue"
          action={
            <Link href="/search" className={buttonStyles("primary")}>
              <Icon name="search" size={15} />
              Find a book
            </Link>
          }
        >
          Look up anything you have been meaning to read. Title, author, series
          or year all work.
        </Route>

        <Route
          icon="sparkle"
          title="Ask your agent"
          action={
            agentReady ? (
              <p className="u-meta text-accent">Agent connected — just ask</p>
            ) : (
              <p className="u-meta text-ink-faint">
                Needs ChatGPT&rsquo;s browser, or Chrome with WebMCP enabled
              </p>
            )
          }
        >
          Photograph your physical shelf and ask it to add what it can see. It
          reads the spines, finds each book in the catalogue, and files them
          here.
        </Route>

        <Route
          icon="upload"
          title="Import from Goodreads"
          action={
            <Link href="/search?import=1" className={buttonStyles("outline")}>
              <Icon name="upload" size={15} />
              Paste a CSV
            </Link>
          }
        >
          Bring a whole reading history across. TBR reads the Title, Author,
          Exclusive Shelf and My Rating columns of a Goodreads export.
        </Route>

        <Route
          icon="bookmark"
          title="Try it with example books"
          action={
            <Button variant="outline" onClick={handleDemo}>
              <Icon name="sparkle" size={15} />
              Load the demo library
            </Button>
          }
        >
          Eighty books with a real reading history behind them, so the taste
          profile has something to find. Clear them any time with{" "}
          <code className="font-mono text-[0.8em] text-ink">resetList()</code>{" "}
          in the console.
        </Route>
      </div>
    </div>
  );
}
