import { useState } from "react";
import { EntryPatch, Project, Tag, TimeEntry } from "../api/types";
import { combineDateTime, dateStrOf, durationSeconds, formatDayLabel, timeStrOf } from "../utils/time";
import EntrySummaryRow from "./EntrySummaryRow";
import ProjectSelect from "./ProjectSelect";
import TagSelect from "./TagSelect";
import BillableToggle from "./BillableToggle";
import TimeInput from "./TimeInput";
import ActionMenu, { ActionMenuItem } from "./ui/ActionMenu";
import DatePickerButton from "./ui/DatePickerButton";
import DurationInput from "./ui/DurationInput";
import { INLINE_INPUT_CLASS } from "./ui/styles";
import { IconMerge, IconPlay, IconTrash } from "./icons";

interface Props {
  entry: TimeEntry;
  projects: Project[];
  tags: Tag[];
  onContinue: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: EntryPatch) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  /** Set only when the neighbouring entry of the same mission follows without a pause. */
  onMergeWithPrevious?: () => void;
  onMergeWithNext?: () => void;
}

const DURATION_INPUT_CLASS =
  "font-mono text-sm w-20 text-center bg-surfaceAlt border-none rounded px-2 py-1.5 text-gray-200 placeholder:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent";

/**
 * A single time entry. Clicking it expands an inline editor where every field
 * (description, project, tags, billable, times, date, duration) is saved as soon as it changes.
 */
export default function EntryRow({
  entry,
  projects,
  tags,
  onContinue,
  onDelete,
  onUpdate,
  onCreateTag,
  onMergeWithPrevious,
  onMergeWithNext,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [description, setDescription] = useState(entry.description);
  const seconds = durationSeconds(entry.start, entry.end);
  const entryDate = dateStrOf(entry.start);

  function commitDescription() {
    if (description !== entry.description) onUpdate(entry.id, { description });
  }

  // Typing a duration moves the end time, keeping the start fixed
  function handleDurationCommit(newSeconds: number) {
    const newEnd = new Date(new Date(entry.start).getTime() + newSeconds * 1000).toISOString();
    onUpdate(entry.id, { end: newEnd });
  }

  // Changing the date moves start and end to that day, keeping their clock times
  function handleDateChange(newDate: string) {
    const patch: EntryPatch = { start: combineDateTime(newDate, timeStrOf(entry.start)) };
    if (entry.end) patch.end = combineDateTime(newDate, timeStrOf(entry.end));
    onUpdate(entry.id, patch);
  }

  const menuItems: ActionMenuItem[] = [];
  if (onMergeWithPrevious) {
    menuItems.push({
      label: "Fusionner avec le créneau précédent",
      icon: <IconMerge className="w-4 h-4" />,
      onSelect: onMergeWithPrevious,
    });
  }
  if (onMergeWithNext) {
    menuItems.push({
      label: "Fusionner avec le créneau suivant",
      icon: <IconMerge className="w-4 h-4" />,
      onSelect: onMergeWithNext,
    });
  }
  menuItems.push({
    label: "Supprimer",
    icon: <IconTrash className="w-4 h-4" />,
    danger: true,
    onSelect: () => onDelete(entry.id),
  });

  return (
    <div className="border-b border-border last:border-b-0">
      <EntrySummaryRow
        description={entry.description}
        project={entry.project}
        billable={entry.billable}
        tags={entry.tags}
        start={entry.start}
        end={entry.end}
        seconds={seconds}
        onClick={() => setExpanded((e) => !e)}
        actions={
          <>
            <button
              onClick={() => onContinue(entry)}
              title="Continuer"
              className="p-1.5 text-muted hover:text-accent rounded"
            >
              <IconPlay />
            </button>
            <ActionMenu items={menuItems} />
          </>
        }
      />

      {expanded && (
        <div className="flex items-center gap-2 flex-wrap px-4 pb-3 pt-1 bg-bg/40">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            placeholder="Description"
            className={`flex-1 min-w-[160px] ${INLINE_INPUT_CLASS}`}
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

          <BillableToggle value={entry.billable} onChange={(billable) => onUpdate(entry.id, { billable })} />

          <TimeInput
            value={timeStrOf(entry.start)}
            onChange={(time) => onUpdate(entry.id, { start: combineDateTime(entryDate, time) })}
            ariaLabel="Heure de début"
          />
          <span className="text-muted">→</span>
          <TimeInput
            value={entry.end ? timeStrOf(entry.end) : ""}
            onChange={(time) => onUpdate(entry.id, { end: combineDateTime(entryDate, time) })}
            ariaLabel="Heure de fin"
          />

          <DatePickerButton
            value={entryDate}
            onChange={handleDateChange}
            label={formatDayLabel(entry.start)}
            paddingY="py-1.5"
          />

          <DurationInput
            seconds={seconds}
            onCommit={handleDurationCommit}
            title="Modifier la durée"
            className={DURATION_INPUT_CLASS}
          />
        </div>
      )}
    </div>
  );
}
