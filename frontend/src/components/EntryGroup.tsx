import { useState } from "react";
import { Project, Tag, TimeEntry } from "../api/types";
import { durationSeconds, formatClock, formatDuration } from "../utils/time";
import EntryRow, { EntryPatch } from "./EntryRow";
import { IconCalendar, IconPlay, IconTag, IconDollar } from "./icons";

interface Props {
  entries: TimeEntry[];
  projects: Project[];
  tags: Tag[];
  onContinue: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: EntryPatch) => void;
  onCreateTag: (name: string) => Promise<Tag>;
}

export default function EntryGroup({
  entries,
  projects,
  tags,
  onContinue,
  onDelete,
  onUpdate,
  onCreateTag,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 1) {
    return (
      <EntryRow
        entry={entries[0]}
        projects={projects}
        tags={tags}
        onContinue={onContinue}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onCreateTag={onCreateTag}
      />
    );
  }

  const first = entries[0];
  const totalSeconds = entries.reduce((sum, e) => sum + durationSeconds(e.start, e.end), 0);
  const sorted = [...entries].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const earliestStart = sorted[0].start;
  const latestEnd = sorted[sorted.length - 1].end;

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-3 px-4 py-3 hover:bg-surfaceAlt cursor-pointer"
      >
        <span className="w-6 h-6 shrink-0 rounded bg-surfaceAlt text-muted text-xs font-medium flex items-center justify-center">
          {entries.length}
        </span>

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-200 truncate">
            {first.description || <span className="text-muted">(sans description)</span>}
          </span>
          {first.project && (
            <span
              className="flex items-center gap-1.5 text-sm shrink-0"
              style={{ color: first.project.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: first.project.color }} />
              {first.project.name}
              {first.project.client && ` - ${first.project.client.name}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {first.billable && <IconDollar className="w-3.5 h-3.5 text-accent" />}
          {first.tags.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <IconTag className="w-3.5 h-3.5" />
              {first.tags.map((t) => t.name).join(", ")}
            </span>
          )}
        </div>

        <div className="text-xs text-muted w-24 text-right shrink-0">
          {formatClock(earliestStart)} - {latestEnd ? formatClock(latestEnd) : "..."}
        </div>

        <IconCalendar className="w-4 h-4 text-muted shrink-0" />

        <div className="font-mono text-sm font-medium text-gray-200 w-20 text-right shrink-0">
          {formatDuration(totalSeconds)}
        </div>

        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onContinue(sorted[sorted.length - 1])}
            title="Continuer"
            className="p-1.5 text-muted hover:text-accent rounded"
          >
            <IconPlay />
          </button>
          <span className="w-7" />
        </div>
      </div>

      {expanded && (
        <div className="bg-bg/30 divide-y divide-border">
          {sorted.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              projects={projects}
              tags={tags}
              onContinue={onContinue}
              onDelete={onDelete}
              onUpdate={onUpdate}
              onCreateTag={onCreateTag}
            />
          ))}
        </div>
      )}
    </div>
  );
}
