import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "outline" | "quiet";
type Size = "sm" | "md";

/** `ComponentPropsWithRef` rather than `ButtonHTMLAttributes`: React 19 passes
 * `ref` as an ordinary prop, so it flows through the spread with no forwardRef. */
interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

/**
 * Corners are 3px, not pill — the whole layout is built on hairline rules and
 * right angles, and rounded buttons would read as a different design system.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent border-accent hover:bg-accent-hover hover:border-accent-hover shadow-[var(--shadow-sm)]",
  outline:
    "bg-paper-raised text-ink border-rule-strong hover:border-ink-faint hover:bg-paper-sunk",
  quiet:
    "bg-transparent text-ink-soft border-transparent hover:text-ink hover:bg-paper-sunk",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

/**
 * The button's visual contract, exported so an anchor can wear it too.
 *
 * Preferred over an `asChild` slot: navigation should render a real `<a>` for
 * middle-click, open-in-new-tab and keyboard behaviour, and sharing the class
 * list costs one function instead of a cloning abstraction.
 */
export function buttonStyles(
  variant: Variant = "outline",
  size: Size = "md",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[3px] border font-medium",
    "transition-[background-color,border-color,color,transform] duration-150",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = "outline",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={buttonStyles(variant, size, className)} {...props}>
      {children}
    </button>
  );
}
