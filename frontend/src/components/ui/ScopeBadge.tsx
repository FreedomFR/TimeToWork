import { IconChevronDown } from "../icons";

/**
 * "Seulement moi" chip shown next to the period picker (Clockify's people filter).
 * Purely informative: the app is single-user, so only your own hours are ever shown.
 */
export default function ScopeBadge() {
  return (
    <span
      title="Seules vos propres heures sont affichées"
      className="flex items-center gap-2 px-3 py-2 text-sm rounded bg-surface border border-border text-gray-200"
    >
      Seulement moi
      <IconChevronDown className="w-3.5 h-3.5 text-muted" />
    </span>
  );
}
