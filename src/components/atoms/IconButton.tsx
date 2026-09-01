import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "@/components/atoms/Icon";
import { cn } from "@/lib/utils/cn";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: these buttons never carry a visible text label. */
  label: string;
  size?: number;
}

export function IconButton({ icon, label, size = 16, className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-[3px]",
        "border border-transparent text-ink-soft",
        "transition-colors duration-150",
        "hover:border-rule hover:bg-paper-raised hover:text-ink",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}
