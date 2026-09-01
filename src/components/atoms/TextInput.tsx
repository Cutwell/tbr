import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Underline rather than a box. The layout's structure comes from hairline
 * rules, and a boxed field would introduce a competing shape language.
 */
export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full border-0 border-b border-rule-strong bg-transparent",
        "pb-2 text-ink placeholder:text-ink-faint",
        "transition-colors duration-200",
        "focus:border-accent focus:outline-none focus:ring-0",
        className,
      )}
      {...props}
    />
  );
}
