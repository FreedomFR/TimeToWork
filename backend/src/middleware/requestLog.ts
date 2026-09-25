import { NextFunction, Request, Response } from "express";
import { LogInput, logEvent } from "../lib/logger";
import { AuthRequest } from "./auth";

/**
 * Journals what an administrator wants to see about each request, once it has been answered:
 *  - a route can describe its own event by setting `res.locals.log` (e.g. a failed login);
 *  - otherwise the status decides: 429 → rate_limited, 403 → forbidden, 400 → validation_error.
 * Server errors (5xx) are logged with their stack by the error handler in app.ts, which marks
 * `res.locals.logged` so they are not recorded twice. Successful requests are not logged.
 */
export function requestLog(req: Request, res: Response, next: NextFunction) {
  res.on("finish", () => {
    if (res.locals.logged) return;

    const explicit = res.locals.log as Partial<LogInput> | undefined;
    const status = res.statusCode;

    let entry: Partial<LogInput> | null = explicit ?? null;
    if (!entry) {
      if (status === 429) entry = { level: "warn", type: "rate_limited", message: "Trop de requêtes" };
      else if (status === 403) entry = { level: "warn", type: "forbidden", message: "Accès refusé" };
      else if (status === 400) {
        entry = {
          level: "info",
          type: "validation_error",
          message: "Données refusées",
          details: res.locals.validationIssues ? { issues: res.locals.validationIssues } : undefined,
        };
      }
    }
    if (!entry) return;

    logEvent({
      level: "info",
      type: "validation_error",
      message: "",
      method: req.method,
      // Query string dropped: it could carry values that must not be stored
      path: req.originalUrl.split("?")[0],
      statusCode: status,
      userId: (req as AuthRequest).userId,
      ...entry,
    } as LogInput);
  });
  next();
}
