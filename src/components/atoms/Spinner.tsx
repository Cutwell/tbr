import { cn } from "@/lib/utils/cn";

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className={cn(
        "inline-block shrink-0 animate-spin rounded-full",
        "border-[1.5px] border-current border-t-transparent opacity-50",
        className,
      )}
    />
  );
}
