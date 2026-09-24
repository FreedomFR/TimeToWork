import { useEffect, useRef, useState } from "react";
import { Project, Tag, TimeEntry } from "../api/types";
import {
  combineDateTime,
  dateStrOf,
  durationSeconds,
  formatClock,
  formatDayLabel,
  formatDuration,
  parseDurationInput,
  timeStrOf,
} from "../utils/time";
import ProjectSelect from "./ProjectSelect";
import TagSelect from "./TagSelect";
import BillableToggle from "./BillableToggle";
import TimeInput from "./TimeInput";
import { IconCalendar, IconTag, IconPlay, IconMore, IconTrash, IconDollar } from "./icons";

export type EntryPatch = Partial<{
  description: string;
  projectId: string | null;
  tagIds: string[];
  billable: boolean;
  start: string;
  end: string;
}>;

interface Props {
  entry: TimeEntry;
  projects: Project[];
  tags: Tag[];
  onContinue: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: EntryPatch) => void;
  onCreateTag: (name: string) => Promise<Tag>;
}

function KebabMenu({ onDelete }: { onDelete: () => void }) {
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
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title="Plus d'options"
        className="p-1.5 text-muted hover:text-gray-200 rounded"
      >
        <IconMore />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 bg-surface border border-border rounded shadow-lg overflow-hidden">
          <button
            onClick={(e) => {
              e.stopPropagation();
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

export default function EntryRow({
  entry,
  projects,
  tags,
  onContinue,
  onDelete,
  onUpdate,
  onCreateTag,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState(entry.description);
  const [durationInput, setDurationInput] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);
  const seconds = durationSeconds(entry.start, entry.end);

  function commitDescription() {
    if (description !== entry.description) {
      onUpdate(entry.id, { description });
    }
  }

  function handleDurationBlur() {
    const parsed = parseDurationInput(durationInput);
    setDurationInput("");
    if (parsed === null) return;
    const newEnd = new Date(new Date(entry.start).getTime() + parsed * 1000).toISOString();
    onUpdate(entry.id, { end: newEnd });
  }

  const entryDate = dateStrOf(entry.start);

  function handleStartTimeChange(time: string) {
    onUpdate(entry.id, { start: combineDateTime(entryDate, time) });
  }

  function handleEndTimeChange(time: string) {
    onUpdate(entry.id, { end: combineDateTime(entryDate, time) });
  }

  function handleDateChange(newDate: string) {
    const patch: EntryPatch = { start: combineDateTime(newDate, timeStrOf(entry.start)) };
    if (entry.end) patch.end = combineDateTime(newDate, timeStrOf(entry.end));
    onUpdate(entry.id, patch);
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-3 px-4 py-3 hover:bg-surfaceAlt cursor-pointer"
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-200 truncate">
            {entry.description || <span className="text-muted">(sans description)</span>}
          </span>
          {entry.project && (
            <span
              className="flex items-center gap-1.5 text-sm shrink-0"
              style={{ color: entry.project.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.project.color }} />
              {entry.project.name}
              {entry.project.client && ` - ${entry.project.client.name}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {entry.billable && <IconDollar className="w-3.5 h-3.5 text-accent" />}
          {entry.tags.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <IconTag className="w-3.5 h-3.5" />
              {entry.tags.map((t) => t.name).join(", ")}
            </span>
          )}
        </div>

        <div className="text-xs text-muted w-24 text-right shrink-0">
          {formatClock(entry.start)} - {entry.end ? formatClock(entry.end) : "..."}
        </div>

        <IconCalendar className="w-4 h-4 text-muted shrink-0" />

        <div className="font-mono text-sm font-medium text-gray-200 w-20 text-right shrink-0">
          {formatDuration(seconds)}
        </div>

        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onContinue(entry)}
            title="Continuer"
            className="p-1.5 text-muted hover:text-accent rounded"
          >
            <IconPlay />
          </button>
          <KebabMenu onDelete={() => onDelete(entry.id)} />
        </div>
      </div>

      {expanded && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 flex-wrap px-4 pb-3 pt-1 bg-bg/40"
        >
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            placeholder="Description"
            className="flex-1 min-w-[160px] bg-surfaceAlt border-none rounded px-2 py-1.5 text-sm text-gray-200 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />

          <ProjectSelect
            projects={projects}
            value={entry.projectId}
            onChange={(projectId) => onUpdate(entry.id, { projectId })}
          />

          <TagSelect
            tags={tags}
            value={entry.tags.map((t) => t.id)}
            onChange={(tagIds) => onUpdate(entry.id, { tagIds })}
            onCreateTag={onCreateTag}
          />

          <BillableToggle
            value={entry.billable}
            onChange={(billable) => onUpdate(entry.id, { billable })}
          />

          <TimeInput
            value={timeStrOf(entry.start)}
            onChange={handleStartTimeChange}
            ariaLabel="Heure de début"
          />
          <span className="text-muted">→</span>
          <TimeInput
            value={entry.end ? timeStrOf(entry.end) : ""}
            onChange={handleEndTimeChange}
            ariaLabel="Heure de fin"
          />

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.focus()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded hover:bg-surfaceAlt text-gray-300 whitespace-nowrap"
            >
              <IconCalendar className="w-4 h-4 text-muted" />
              {formatDayLabel(entry.start)}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={entryDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
            />
          </div>

          <input
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            onBlur={handleDurationBlur}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            placeholder={formatDuration(seconds)}
            title="Modifier la durée"
            className="font-mono text-sm w-20 text-center bg-surfaceAlt border-none rounded px-2 py-1.5 text-gray-200 placeholder:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
      )}
    </div>
  );
}
