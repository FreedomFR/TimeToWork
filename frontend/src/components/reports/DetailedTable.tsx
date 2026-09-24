import { useEffect, useRef, useState } from "react";
import { Tag, TimeEntry } from "../../api/types";
import { formatClock, formatDuration, durationSeconds, dateStrOf } from "../../utils/time";
import TagSelect from "../TagSelect";
import { IconMore, IconPlay, IconTrash } from "../icons";

interface Props {
  entries: TimeEntry[];
  tags: Tag[];
  userName: string;
  onUpdateTags: (id: string, tagIds: string[]) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onContinue: (entry: TimeEntry) => void;
}

const TAG_BUTTON_CLASS =
  "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-border text-muted hover:text-gray-200 hover:border-gray-500 whitespace-nowrap";

function RowMenu({ onContinue, onDelete }: { onContinue: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Plus d'options"
        className="p-1.5 text-muted hover:text-gray-200 rounded"
      >
        <IconMore />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 bg-surface border border-border rounded shadow-lg overflow-hidden">
          <button
            onClick={() => {
              setOpen(false);
              onContinue();
            }}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-gray-200 hover:bg-surfaceAlt"
          >
            <IconPlay className="w-4 h-4" />
            Continuer
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-red-400 hover:bg-surfaceAlt"
          >
            <IconTrash className="w-4 h-4" />
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

export default function DetailedTable({
  entries,
  tags,
  userName,
  onUpdateTags,
  onCreateTag,
  onDelete,
  onDeleteMany,
  onContinue,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = [...entries].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  const allSelected = sorted.length > 0 && selected.size === sorted.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sorted.map((e) => e.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    onDeleteMany(Array.from(selected));
    setSelected(new Set());
  }

  return (
    <div className="bg-surface rounded-lg border border-border">
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-surfaceAlt">
          <span className="text-sm text-gray-200">{selected.size} sélectionnée(s)</span>
          <button
            onClick={deleteSelected}
            className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300"
          >
            <IconTrash className="w-4 h-4" />
            Supprimer la sélection
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted border-b border-border">
        <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-accent" />
        <span className="flex-1">CRÉNEAU</span>
        <span className="w-28 text-right shrink-0">UTILISATEUR</span>
        <span className="w-24 text-right shrink-0">TEMPS</span>
        <span className="w-20 text-right shrink-0">DURÉE</span>
        <span className="w-7 shrink-0" />
      </div>

      {sorted.map((entry) => {
        const seconds = durationSeconds(entry.start, entry.end);
        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-surfaceAlt"
          >
            <input
              type="checkbox"
              checked={selected.has(entry.id)}
              onChange={() => toggleOne(entry.id)}
              className="accent-accent shrink-0"
            />

            <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
              <div className="min-w-0">
                <span className="text-sm text-gray-200 truncate block">
                  {entry.description || <span className="text-muted">(sans description)</span>}
                </span>
                {entry.project && (
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: entry.project.color }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.project.color }} />
                    {entry.project.name}
                    {entry.project.client && ` - ${entry.project.client.name}`}
                  </span>
                )}
              </div>
              <TagSelect
                tags={tags}
                value={entry.tags.map((t) => t.id)}
                onChange={(tagIds) => onUpdateTags(entry.id, tagIds)}
                onCreateTag={onCreateTag}
                emptyLabel="Ajouter les balises"
                buttonClassName={TAG_BUTTON_CLASS}
              />
            </div>

            <span className="w-28 text-right shrink-0 text-sm text-muted truncate">{userName}</span>

            <div className="w-24 text-right shrink-0">
              <div className="text-sm text-gray-300">
                {formatClock(entry.start)} {entry.end ? formatClock(entry.end) : "..."}
              </div>
              <div className="text-xs text-muted">{dateStrOf(entry.start)}</div>
            </div>

            <span className="w-20 text-right shrink-0 font-mono text-sm text-gray-100">
              {formatDuration(seconds)}
            </span>

            <div className="w-7 shrink-0 flex justify-end">
              <RowMenu onContinue={() => onContinue(entry)} onDelete={() => onDelete(entry.id)} />
            </div>
          </div>
        );
      })}

      {sorted.length === 0 && (
        <div className="text-center text-muted text-sm py-12">Aucune donnée pour cette période</div>
      )}
    </div>
  );
}
