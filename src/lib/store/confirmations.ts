import { useSyncExternalStore } from "react";

/**
 * Promise-based confirmation requests.
 *
 * This is the machinery behind the human-in-the-loop story. WebMCP's
 * `requestUserInteraction()` expects a tool handler to *await* a real decision
 * from the person at the keyboard, which means the confirmation has to be
 * awaitable from outside React. So the request lives in a module-level store,
 * the dialog renders whatever is pending, and the button click resolves the
 * promise the agent is blocked on.
 *
 * The same call powers the delete button in the UI, so there is exactly one
 * confirmation path whether the request came from a person or an agent.
 */

export interface ConfirmRequest {
  id: string;
  title: string;
  body?: string;
  confirmLabel: string;
  /** Marks the request as agent-initiated, which the dialog says out loud. */
  source?: "agent";
}

interface PendingRequest extends ConfirmRequest {
  resolve: (confirmed: boolean) => void;
}

let pending: PendingRequest | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function requestConfirmation(
  request: Omit<ConfirmRequest, "id">,
): Promise<boolean> {
  // A second request while one is open resolves the first as declined rather
  // than stranding a promise nobody will ever settle.
  pending?.resolve(false);

  return new Promise<boolean>((resolve) => {
    pending = {
      ...request,
      id: `c_${Date.now().toString(36)}`,
      resolve,
    };
    emit();
  });
}

export function settleConfirmation(confirmed: boolean): void {
  const request = pending;
  if (!request) return;
  pending = null;
  emit();
  request.resolve(confirmed);
}

const confirmations = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => pending as ConfirmRequest | null,
  getServerSnapshot: () => null,
};

export function usePendingConfirmation(): ConfirmRequest | null {
  return useSyncExternalStore(
    confirmations.subscribe,
    confirmations.getSnapshot,
    confirmations.getServerSnapshot,
  );
}
