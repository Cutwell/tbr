"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { ConfirmDialog } from "@/components/organisms/ConfirmDialog";
import { NavigationController } from "@/components/organisms/NavigationController";
import { SiteHeader } from "@/components/organisms/SiteHeader";
import { ToastStack } from "@/components/organisms/ToastStack";
import { library } from "@/lib/store/store";
import { initialiseWebMCP } from "@/lib/webmcp/register";

/**
 * The application shell: header, page, and the two global surfaces.
 *
 * Start-up lives here rather than in a page so it happens once for the whole
 * session regardless of the entry route — a reader who lands on a book page
 * gets the same hydrated library and the same registered tools as one who
 * lands on the shelf.
 *
 * Order matters: the store must hold real books before the tools are
 * registered, or an eager first tool call reads an empty library.
 */
export function AppShell({ children }: { children: ReactNode }) {
  useEffect(() => {
    library.hydrate();
    library.exposeConsoleApi();
    void initialiseWebMCP();
  }, []);

  return (
    <>
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[92rem] flex-col px-5 py-8 md:px-10 md:py-12">
        <SiteHeader />
        <main className="flex-1 pt-9">{children}</main>
      </div>

      <ConfirmDialog />
      <ToastStack />
      <NavigationController />
    </>
  );
}
