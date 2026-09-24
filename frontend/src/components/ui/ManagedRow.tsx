import { ReactNode } from "react";

interface Props {
  name: string;
  archived: boolean;
  /** Content before the name (e.g. the project's color dot). */
  leading?: ReactNode;
  /** Secondary info shown after the name (e.g. the client). */
  meta?: ReactNode;
  expanded: boolean;
  onToggleExpanded: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  /** Inline edit panel, rendered under the row while expanded. */
  children: ReactNode;
}

/**
 * List row shared by the Projects and Clients pages: name, "Archiver/Réactiver"
 * and "Supprimer" actions, and an expandable inline edit panel.
 */
export default function ManagedRow({
  name,
  archived,
  leading,
  meta,
  expanded,
  onToggleExpanded,
  onToggleArchive,
  onDelete,
  children,
}: Props) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div onClick={onToggleExpanded} className="flex items-center gap-3 px-4 py-3 hover:bg-surfaceAlt cursor-pointer">
        {leading}
        <span className={`text-sm flex-1 ${archived ? "text-muted line-through" : "text-gray-200"}`}>{name}</span>
        {meta}
        {/* Clicks on the actions must not toggle the edit panel */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onToggleArchive} className="text-xs text-muted hover:text-gray-200 px-2">
            {archived ? "Réactiver" : "Archiver"}
          </button>
          <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300 px-2">
            Supprimer
          </button>
        </div>
      </div>
      {expanded && children}
    </div>
  );
}
