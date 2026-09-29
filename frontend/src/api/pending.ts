import { useSyncExternalStore } from "react";

/**
 * How many API requests are in flight right now. Kept outside React so the axios interceptors
 * (api/client.ts) can update it, and any component can follow it with `usePendingRequests`.
 */
let pending = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Marks a request as started; call the returned function once when it ends (extra calls do nothing). */
export function trackRequest(): () => void {
  pending += 1;
  emit();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    pending -= 1;
    emit();
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingRequests(): number {
  return useSyncExternalStore(subscribe, () => pending);
}
