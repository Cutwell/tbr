"use client";

import { useMemo } from "react";
import { TasteProfile } from "@/components/organisms/TasteProfile";
import { buildTasteProfile } from "@/lib/store/profile";
import { useLibrary } from "@/lib/store/useLibrary";

export default function TastePage() {
  const books = useLibrary();

  const profile = useMemo(() => buildTasteProfile(books), [books]);

  const recent = useMemo(
    () =>
      books
        .filter((book) => book.shelf === "read")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 6),
    [books],
  );

  return <TasteProfile profile={profile} recent={recent} />;
}
