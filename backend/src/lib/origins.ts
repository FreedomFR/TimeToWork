import type { NextFunction, Request, Response } from "express";

/**
 * Which websites may call the API from a browser.
 *
 * The API is meant for the TimeToWork frontend only. Left open to every origin, any page you visit
 * could talk to a backend running on your machine (http://localhost:4000): read what it answers and,
 * with DEV_MODE on, sign in as anyone. Allowed: the frontend (APP_URL, plus its localhost /
 * 127.0.0.1 twin) and whatever CORS_ORIGINS lists (comma-separated, e.g. a second domain).
 * Requests without an Origin header (curl, servers, the tests' API calls) are not affected.
 */
export function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const add = (value: string) => {
    try {
      origins.add(new URL(value.trim()).origin);
    } catch {
      /* not a URL: ignored */
    }
  };

  const appUrl = process.env.APP_URL || "http://localhost:8080";
  add(appUrl);
  // The same page opened as localhost or as 127.0.0.1 is the same app
  const url = new URL(appUrl);
  if (url.hostname === "localhost") add(`${url.protocol}//127.0.0.1${url.port ? `:${url.port}` : ""}`);
  if (url.hostname === "127.0.0.1") add(`${url.protocol}//localhost${url.port ? `:${url.port}` : ""}`);

  for (const extra of (process.env.CORS_ORIGINS || "").split(",")) if (extra.trim()) add(extra);
  return origins;
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || allowedOrigins().has(origin);
}

/** Refuses (403, journaled as "forbidden") any request that comes from a page of another website. */
export function rejectForeignOrigins(req: Request, res: Response, next: NextFunction) {
  if (isAllowedOrigin(req.headers.origin)) return next();
  res.status(403).json({ error: "Origin not allowed" });
}
