import { useMemo, useRef, useState } from "react";
import { TimeEntry } from "../api/types";
import { useClickOutside } from "../hooks/useClickOutside";
import ProjectLabel from "./ui/ProjectLabel";

/** How many recent tasks are proposed when the field gets focus. */
const MAX_SUGGESTIONS = 5;

interface Props {
  value: string;
  onChange: (description: string) => void;
  /** Called when a suggestion is picked, so the parent can also copy its project. */
  onPickSuggestion: (entry: TimeEntry) => void;
  /** Past entries (most recent first) the suggestions are drawn from. */
  recentEntries: TimeEntry[];
  disabled?: boolean;
}

/**
 * Description field of the timer bar. Focusing it lists the last distinct tasks
 * (filtered by what is typed); picking one fills the description and project.
 */
export default function DescriptionInput({ value, onChange, onPickSuggestion, recentEntries, disabled }: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useClickOutside(boxRef, () => setShowSuggestions(false));

  // The N most recent entries with distinct, non-empty descriptions
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: TimeEntry[] = [];
    for (const entry of recentEntries) {
      const key = entry.description.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(entry);
      if (result.length >= MAX_SUGGESTIONS) break;
    }
    return result;
  }, [recentEntries]);

  const visible = useMemo(() => {
    const query = value.trim().toLowerCase();
    return query ? suggestions.filter((s) => s.description.toLowerCase().includes(query)) : suggestions;
  }, [suggestions, value]);

  return (
    <div className="relative flex-1 min-w-[160px]" ref={boxRef}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        placeholder="Sur quoi avez-vous travaillé ?"
        disabled={disabled}
        className="w-full bg-transparent border-none focus:outline-none text-sm px-2 py-2 text-gray-200 placeholder:text-muted"
      />

      {showSuggestions && visible.length > 0 && (
        <div className="absolute z-20 mt-1 left-0 w-96 max-w-[90vw] bg-surface border border-border rounded shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-xs text-muted border-b border-border">Tâches récentes</div>
          {visible.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onPickSuggestion(s);
                setShowSuggestions(false);
              }}
              className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-surfaceAlt"
            >
              <span className="text-gray-200 truncate flex-1 min-w-0">{s.description}</span>
              {s.project && <ProjectLabel project={s.project} className="text-xs" showClient={false} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
