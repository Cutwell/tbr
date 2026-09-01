"use client";

import { BookCard } from "@/components/organisms/BookCard";
import type { Book, Rating, Shelf } from "@/lib/types";
import type { ReactNode } from "react";

interface BookGridProps {
  books: readonly Book[];
  highlighted: ReadonlySet<string>;
  empty: ReactNode;
  onSetShelf: (id: string, shelf: Shelf) => void;
  onRate: (id: string, rating: Rating | undefined) => void;
  onRemove: (id: string) => void;
}

export function BookGrid({
  books,
  highlighted,
  empty,
  onSetShelf,
  onRate,
  onRemove,
}: BookGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {books.length === 0
        ? empty
        : books.map((book, index) => (
            <BookCard
              key={book.id}
              book={book}
              index={index}
              priority={index < 6}
              highlighted={highlighted.has(book.id)}
              onSetShelf={onSetShelf}
              onRate={onRate}
              onRemove={onRemove}
            />
          ))}
    </div>
  );
}
