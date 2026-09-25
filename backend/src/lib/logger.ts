/**
 * Application journal: events worth an administrator's attention are stored in the `LogEntry`
 * table and shown on the admin page.
 *
 * Rules for what goes in:
 *  - never a password, a token or a request body — only what is needed to understand an incident;
 *  - every field is truncated, so no request can bloat the table;
 *  - writing a log must never break the request that triggered it (errors are swallowed).
 */
import { prisma } from "./prisma";

/** The kinds of event, i.e. the "type of bug" an admin can filter on. */
export const LOG_TYPES = [
  "server_error", // an unexpected error in the API (5xx)
  "client_error", // a JavaScript error reported by a browser
  "auth_failed", // wrong password, invalid reset link…
  "rate_limited", // a limit was hit (429)
  "forbidden", // access refused (403), e.g. a non-admin calling an admin route
  "validation_error", // the API refused the data it received (400)
  "admin_action", // audit trail: role changes
] as const;
export type LogType = (typeof LOG_TYPES)[number];

export const LOG_LEVELS = ["info", "warn", "error"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogInput {
  level: LogLevel;
  type: LogType;
  message: string;
  method?: string;
  path?: string;
  statusCode?: number;
  /** A stack trace, or a small object that is stored as JSON. */
  details?: string | Record<string, unknown>;
  /** The account concerned; its email is looked up when `userEmail` isn't given. */
  userId?: string | null;
  userEmail?: string | null;
}

const MAX_MESSAGE = 500;
const MAX_DETAILS = 4000;
const MAX_PATH = 300;
const MAX_EMAIL = 254;
const DEFAULT_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const cut = (value: string, max: number) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

// Writes are not awaited by the request; tests wait for them with `flushLogs()`
const pending = new Set<Promise<void>>();

async function write(input: LogInput) {
  let userEmail = input.userEmail ?? null;
  if (!userEmail && input.userId) {
    const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
    userEmail = user?.email ?? null;
  }
  const details = typeof input.details === "object" ? JSON.stringify(input.details) : input.details;

  await prisma.logEntry.create({
    data: {
      level: input.level,
      type: input.type,
      message: cut(input.message, MAX_MESSAGE),
      method: input.method?.slice(0, 10),
      path: input.path ? cut(input.path, MAX_PATH) : undefined,
      statusCode: input.statusCode,
      details: details ? cut(details, MAX_DETAILS) : undefined,
      userId: input.userId ?? undefined,
      userEmail: userEmail ? cut(userEmail, MAX_EMAIL) : undefined,
    },
  });
}

/** Records an event in the background. Never throws and never delays the caller. */
export function logEvent(input: LogInput): void {
  const task: Promise<void> = write(input)
    .catch((err) => console.error("[logger] could not store a log entry:", err))
    .finally(() => pending.delete(task));
  pending.add(task);
}

/** Resolves once every log write started so far is finished (used by the tests). */
export async function flushLogs(): Promise<void> {
  await Promise.all(Array.from(pending));
}

/** Deletes the entries older than `days` days and returns how many were removed. */
export async function purgeOldLogs(days: number): Promise<number> {
  const result = await prisma.logEntry.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * DAY_MS) } } });
  return result.count;
}

/** Keeps the table small: purges once at startup, then every day. `LOG_RETENTION_DAYS` sets the age (default 30). */
export function startLogRetention(): void {
  const days = Number(process.env.LOG_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS;
  const run = () => purgeOldLogs(days).catch((err) => console.error("[logger] purge failed:", err));
  void run();
  setInterval(run, DAY_MS).unref();
}
