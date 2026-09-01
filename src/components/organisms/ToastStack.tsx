"use client";

import { Icon } from "@/components/atoms/Icon";
import { IconButton } from "@/components/atoms/IconButton";
import { dismiss, useNotifications } from "@/lib/store/notifications";
import { cn } from "@/lib/utils/cn";

/**
 * Toasts, bottom-left so they never cover the shelf.
 *
 * Agent-raised toasts carry an accent rule and a sparkle. This is the ambient
 * proof that a tool call did something — without it, an agent working through
 * a list of books just looks like a page quietly changing on its own.
 */
export function ToastStack() {
  const notifications = useNotifications();
  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 left-5 z-40 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2"
    >
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={cn(
            "animate-rise pointer-events-auto flex items-center gap-3",
            "border bg-paper-raised px-3.5 py-3 shadow-[var(--shadow-lg)]",
            notification.source === "agent"
              ? "border-rule border-l-2 border-l-accent"
              : "border-rule",
          )}
        >
          {notification.source === "agent" && (
            <Icon name="sparkle" size={14} className="shrink-0 text-accent" />
          )}

          <p className="flex-1 text-[0.8125rem] leading-snug text-pretty text-ink">
            {notification.message}
          </p>

          {notification.action && (
            <button
              type="button"
              onClick={() => {
                notification.action?.run();
                dismiss(notification.id);
              }}
              className="u-meta shrink-0 text-accent underline decoration-accent/40 underline-offset-3 hover:decoration-accent"
            >
              {notification.action.label}
            </button>
          )}

          <IconButton
            icon="close"
            label="Dismiss"
            size={13}
            onClick={() => dismiss(notification.id)}
            className="h-6 w-6 shrink-0"
          />
        </div>
      ))}
    </div>
  );
}
