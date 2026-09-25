/** Field validators shared by the routes: every value that reaches the database is bounded and well-formed. */
import { z } from "zod";

/** A name (project, client, tag): non-empty, trimmed, bounded. */
export const nameField = z.string().trim().min(1).max(200);

/** Free text of an entry. Bounded so nobody can fill the database through one field. */
export const descriptionField = z.string().max(2000);

/** `#rrggbb`. Colors are rendered into style attributes, so they must not carry arbitrary CSS. */
export const colorField = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color");

/** A date/time string `new Date()` can parse (an invalid one would make Prisma throw). */
export const dateField = z.string().max(64).refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date");

export const tagIdsField = z.array(z.string().uuid()).max(50);

/** Passwords: 8+ characters; bcrypt silently ignores everything past 72 bytes, so cap it there. */
export const newPasswordField = z.string().min(8).max(72);

/** Optional `from` / `to` query parameters of the entry and report routes. */
export const dateRangeQuery = z.object({
  from: dateField.optional(),
  to: dateField.optional(),
});
