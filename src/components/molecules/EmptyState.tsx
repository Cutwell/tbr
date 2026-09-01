import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 border border-dashed border-rule px-6 py-20 text-center">
      <h3 className="font-display text-2xl text-ink">{title}</h3>
      <p className="max-w-sm text-sm text-pretty text-ink-soft">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
