import { useRef, useState } from "react";
import { Tag } from "../api/types";
import { useClickOutside } from "../hooks/useClickOutside";
import { IconChevronDown, IconTag } from "./icons";

interface Props {
  tags: Tag[];
  value: string[];
  onChange: (tagIds: string[]) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  emptyLabel?: string;
  buttonClassName?: string;
  /** Behave like a form field: fill the parent's width (trigger and menu) and show a chevron. */
  fullWidth?: boolean;
}

/**
 * Multi-select of tags with search and inline creation (Enter or "+ Créer").
 * `buttonClassName` swaps the default trigger for a custom-styled one (used in the detailed report).
 */
export default function TagSelect({
  tags,
  value,
  onChange,
  onCreateTag,
  emptyLabel,
  buttonClassName,
  fullWidth = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => {
    setOpen(false);
    setQuery("");
  });

  function toggleTag(id: string) {
    onChange(value.includes(id) ? value.filter((t) => t !== id) : [...value, id]);
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name) return;
    const tag = await onCreateTag(name);
    onChange([...value, tag.id]);
    setQuery("");
  }

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()));
  const exactMatch = tags.some((t) => t.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className={`relative ${fullWidth ? "w-full" : "shrink-0"}`} ref={ref}>
      <button
        type="button"
        title="Tags"
        onClick={() => setOpen((o) => !o)}
        className={
          buttonClassName ||
          `flex items-center gap-1.5 px-2.5 py-2 text-sm rounded hover:bg-surfaceAlt max-w-[140px] text-left ${
            value.length > 0 ? "text-gray-200" : "text-muted"
          }`
        }
      >
        {!buttonClassName && <IconTag className="w-4 h-4 shrink-0" />}
        {value.length > 0 ? (
          <span className="truncate">
            {value
              .map((id) => tags.find((t) => t.id === id)?.name)
              .filter(Boolean)
              .join(", ")}
          </span>
        ) : (
          emptyLabel && <span className="truncate">{emptyLabel}</span>
        )}
        {fullWidth && <IconChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />}
      </button>

      {open && (
        <div
          className={`absolute z-20 mt-1 bg-surface border border-border rounded shadow-lg ${
            fullWidth ? "left-0 right-0" : "w-64"
          }`}
        >
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !exactMatch) handleCreate();
                // Escape closes only this menu, not a modal it may be displayed in
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setOpen(false);
                  setQuery("");
                }
              }}
              placeholder="Rechercher ou créer un tag"
              className="w-full bg-surfaceAlt border border-border rounded px-2 py-1.5 text-sm text-gray-200 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surfaceAlt cursor-pointer text-gray-200"
              >
                <input
                  type="checkbox"
                  checked={value.includes(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="accent-accent"
                />
                {tag.name}
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted">Aucun tag</p>
            )}
          </div>
          {query.trim() && !exactMatch && (
            <button
              onClick={handleCreate}
              className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-surfaceAlt border-t border-border"
            >
              + Créer "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
