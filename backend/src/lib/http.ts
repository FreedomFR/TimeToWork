import { Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodTypeAny, z } from "zod";

/**
 * Validates `body` against `schema`.
 *
 * On failure it sends a 400 response (`{ error: <zod flatten> }`) and returns
 * `null`, so callers only need `if (!data) return;`.
 */
export function parseBody<S extends ZodTypeAny>(schema: S, body: unknown, res: Response): z.infer<S> | null {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return null;
  }
  return parsed.data;
}

/** Sends the standard 404 response used when a row is missing or belongs to another user. */
export function notFound(res: Response, message = "Not found") {
  return res.status(404).json({ error: message });
}

/**
 * Builds a Prisma filter on `TimeEntry.start` from optional `from` / `to`
 * ISO date strings (both bounds inclusive). Returns `undefined` when neither
 * is given so it can be spread straight into a `where` clause.
 */
export function startRangeFilter(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (from) filter.gte = new Date(from);
  if (to) filter.lte = new Date(to);
  return filter;
}
