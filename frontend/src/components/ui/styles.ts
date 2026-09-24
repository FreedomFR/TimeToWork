/**
 * Tailwind class strings reused by several components.
 * They live here (as full literal strings) so Tailwind's scanner still finds every class.
 */

/** Standard text field / select on a `surface` card. */
export const INPUT_CLASS =
  "bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent";

/** Compact variant used by inline edit panels. */
export const INLINE_INPUT_CLASS =
  "bg-surfaceAlt border-none rounded px-2 py-1.5 text-sm text-gray-200 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent";

/** Primary blue action button (size classes are added by the caller). */
export const PRIMARY_BUTTON_CLASS = "bg-accent hover:bg-accentDark text-white font-medium rounded transition-colors";

/** Card container used for every panel of the app. */
export const CARD_CLASS = "bg-surface rounded-lg border border-border";
