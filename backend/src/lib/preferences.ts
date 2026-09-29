import { z } from "zod";

/**
 * Display settings of a user ("Mon compte" > Apparence). Stored as JSON on the user so a new
 * setting needs no migration: add it here, with its default, and it works.
 *
 * A stored value that is missing or no longer valid (a setting that was removed, a hand-edited
 * row) silently falls back to its default, so a bad row can never lock anybody out.
 */
const FIELDS = {
  /** Small transitions and entrance effects. The system's "reduce motion" setting always wins in the browser. */
  animations: z.boolean(),
  /** Scale of all text and spacing: 100 %, 112.5 %, 125 %. */
  textSize: z.enum(["normal", "large", "xlarge"]),
};

export const DEFAULT_PREFERENCES = { animations: true, textSize: "normal" } as const;

export type Preferences = { [K in keyof typeof FIELDS]: z.infer<(typeof FIELDS)[K]> };

/** What the client may send: any subset of the settings, nothing else. */
export const preferencesUpdateSchema = z.object(FIELDS).partial().strict();

/** The full settings of a user from what is stored: valid values kept, the rest defaulted. */
export function readPreferences(stored: unknown): Preferences {
  const source = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  const result: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(FIELDS)) {
    const parsed = schema.safeParse(source[key]);
    result[key] = parsed.success ? parsed.data : DEFAULT_PREFERENCES[key as keyof Preferences];
  }
  return result as Preferences;
}
