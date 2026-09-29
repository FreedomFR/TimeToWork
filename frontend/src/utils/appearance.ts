import { Preferences, TextSize } from "../api/types";

/**
 * Display settings ("Mon compte" > Apparence). The server keeps them per user; here they are
 * turned into attributes on <html> that index.css reacts to, and cached in localStorage so the page
 * does not flash the default look while the user is being loaded on a reload.
 * The cache is only a convenience: the server's value replaces it as soon as it arrives.
 */

export const DEFAULT_PREFERENCES: Preferences = { animations: true, textSize: "normal" };

export const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: "normal", label: "Normale" },
  { value: "large", label: "Grande" },
  { value: "xlarge", label: "Très grande" },
];

const CACHE_KEY = "appearance";

export function applyAppearance(prefs: Preferences) {
  const root = document.documentElement;
  root.dataset.animations = prefs.animations ? "on" : "off";
  root.dataset.textSize = prefs.textSize;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable (private window...): the settings still apply, they just are not cached */
  }
}

/** At startup: applies the last known settings of this browser, if any, before the first render. */
export function applyCachedAppearance() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (cached && typeof cached.animations === "boolean" && TEXT_SIZES.some((s) => s.value === cached.textSize)) {
      applyAppearance(cached);
    }
  } catch {
    /* unreadable cache: ignored */
  }
}

/** Back to the default look (signed out: the next person must not inherit the settings). */
export function resetAppearance() {
  applyAppearance(DEFAULT_PREFERENCES);
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to clean */
  }
}

/** True when the operating system asks for less motion: animations then stay off whatever the setting. */
export function systemReducesMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
