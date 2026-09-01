"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/atoms/Button";
import { Icon } from "@/components/atoms/Icon";
import { settleConfirmation, usePendingConfirmation } from "@/lib/store/confirmations";

/**
 * The single confirmation surface, for people and agents alike.
 *
 * When an agent is the one asking, the dialog says so — the reader should never
 * be unclear about who is proposing to delete their book. Declining is the
 * default: Escape, the backdrop, and the cancel button all resolve to `false`,
 * and that answer is reported back to the agent rather than swallowed.
 */
export function ConfirmDialog() {
  const request = usePendingConfirmation();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") settleConfirmation(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request]);

  if (!request) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center p-6"
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={() => settleConfirmation(false)}
        className="absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[2px]"
      />

      <div className="animate-rise relative w-full max-w-md border border-rule-strong bg-paper-raised p-7 shadow-[var(--shadow-lg)]">
        {request.source === "agent" && (
          <p className="u-meta mb-4 inline-flex items-center gap-1.5 border border-accent/35 bg-accent-wash px-2 py-1 text-accent">
            <Icon name="sparkle" size={12} />
            The agent is asking
          </p>
        )}

        <h2 id="confirm-title" className="font-display text-2xl leading-snug text-balance text-ink">
          {request.title}
        </h2>

        {request.body && (
          <p className="mt-2.5 text-sm text-pretty text-ink-soft">{request.body}</p>
        )}

        <div className="mt-7 flex justify-end gap-2">
          <Button variant="quiet" onClick={() => settleConfirmation(false)}>
            Cancel
          </Button>
          <Button ref={confirmRef} variant="primary" onClick={() => settleConfirmation(true)}>
            {request.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
