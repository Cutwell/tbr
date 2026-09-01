"use client";

import { Icon } from "@/components/atoms/Icon";
import { Spinner } from "@/components/atoms/Spinner";
import { TextInput } from "@/components/atoms/TextInput";
import { cn } from "@/lib/utils/cn";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  busy?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  busy = false,
  autoFocus = false,
  className,
}: SearchFieldProps) {
  return (
    <div className={cn("flex items-end gap-3", className)}>
      <Icon name="search" size={20} className="mb-2 shrink-0 text-ink-faint" />
      <TextInput
        type="search"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="font-display text-xl md:text-2xl"
        aria-label={placeholder}
      />
      <span className="mb-2 flex h-5 w-5 shrink-0 items-center justify-center text-ink-faint">
        {busy ? <Spinner /> : null}
      </span>
    </div>
  );
}
