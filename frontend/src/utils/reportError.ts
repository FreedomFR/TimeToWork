import { api } from "../api/client";

/** Where an error was caught. */
type Kind = "error" | "unhandledrejection" | "react";

const MAX_REPORTS_PER_PAGE_LOAD = 20;
let sent = 0;
const recent = new Map<string, number>();
const DEDUPE_MS = 10_000;

/** Browser noise that says nothing about a bug in the app. */
const IGNORED = [/ResizeObserver loop/i, /^Script error\.?$/i];

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

/**
 * Sends a JavaScript error to the backend's journal so an admin can see it. Best effort:
 * signed-out users, duplicates, floods and failures are all silently dropped, and this never
 * throws (a bug reporter must not become a bug).
 */
export function reportClientError(error: unknown, kind: Kind = "error") {
  try {
    if (!localStorage.getItem("token")) return;
    // Failed API calls are already journaled by the server, with more context
    if ((error as { isAxiosError?: boolean })?.isAxiosError) return;

    const { message, stack } = describe(error);
    if (!message || IGNORED.some((re) => re.test(message))) return;
    if (sent >= MAX_REPORTS_PER_PAGE_LOAD) return;

    const now = Date.now();
    const key = `${kind}|${message}`;
    if (now - (recent.get(key) ?? 0) < DEDUPE_MS) return;
    recent.set(key, now);
    sent += 1;

    void api
      .post("/logs/client", {
        message: message.slice(0, 500),
        stack: stack?.slice(0, 4000),
        url: window.location.href.slice(0, 500),
        kind,
      })
      .catch(() => {});
  } catch {
    // ignore
  }
}

/** Reports every uncaught error and unhandled promise rejection of the page. */
export function installErrorReporting() {
  window.addEventListener("error", (e) => reportClientError(e.error ?? e.message, "error"));
  window.addEventListener("unhandledrejection", (e) => reportClientError(e.reason, "unhandledrejection"));
}
