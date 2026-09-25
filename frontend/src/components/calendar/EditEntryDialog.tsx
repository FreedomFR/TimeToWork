import { useState } from "react";
import { EntryPatch, Project, Tag, TimeEntry } from "../../api/types";
import {
  combineDateTime,
  dateStrOf,
  durationSeconds,
  formatDuration,
  timeStrOf,
  toTimeStr,
} from "../../utils/time";
import Modal from "../ui/Modal";
import ActionMenu from "../ui/ActionMenu";
import DurationInput from "../ui/DurationInput";
import TimeInput from "../TimeInput";
import TagSelect from "../TagSelect";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "../ui/styles";
import { IconTrash } from "../icons";

interface Props {
  entry: TimeEntry;
  projects: Project[];
  tags: Tag[];
  /** Persists the changes; the dialog closes when it resolves. */
  onSave: (id: string, patch: EntryPatch) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag>;
  onClose: () => void;
}

const TAG_BUTTON_CLASS = `${INPUT_CLASS} w-full flex items-center justify-between text-left`;
const DURATION_INPUT_CLASS =
  "font-mono text-lg w-32 text-center bg-surfaceAlt border border-border rounded px-2 py-2 text-gray-100 placeholder:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent";
const LABEL_CLASS = "text-sm text-gray-200 sm:pt-2";

/** Whole calendar days between the local dates of two ISO strings (0 = same day, 1 = next day…). */
function dayOffset(startIso: string, endIso: string): number {
  const startDay = new Date(dateStrOf(startIso)).getTime();
  const endDay = new Date(dateStrOf(endIso)).getTime();
  return Math.round((endDay - startDay) / 86_400_000);
}

/**
 * "Modifier le créneau" modal opened from the calendar: edit an entry's date, start/end
 * times (or its duration), description, project and tags, then save — or delete it from
 * the ⋮ menu. Times use the same free-form fields as the time tracker ("0800" → 08:00).
 *
 * The end time keeps the day offset the entry originally had, so an entry running past
 * midnight stays valid; a running entry (no end yet) only edits its start.
 */
export default function EditEntryDialog({ entry, projects, tags, onSave, onDelete, onCreateTag, onClose }: Props) {
  const running = entry.end === null;

  const [date, setDate] = useState(dateStrOf(entry.start));
  const [startTime, setStartTime] = useState(timeStrOf(entry.start));
  const [endTime, setEndTime] = useState(entry.end ? timeStrOf(entry.end) : "");
  const [endDayOffset, setEndDayOffset] = useState(entry.end ? dayOffset(entry.start, entry.end) : 0);
  const [description, setDescription] = useState(entry.description);
  const [projectId, setProjectId] = useState<string | null>(entry.projectId);
  const [tagIds, setTagIds] = useState<string[]>(entry.tags.map((t) => t.id));
  const [busy, setBusy] = useState(false);

  const startIso = combineDateTime(date, startTime);
  const endIso = running ? null : shiftDays(combineDateTime(date, endTime), endDayOffset);
  const seconds = endIso ? (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000 : durationSeconds(startIso, null);
  const invalidRange = !running && seconds <= 0;

  // Typing a duration moves the end time, keeping the start fixed
  function handleDurationCommit(newSeconds: number) {
    const newEnd = new Date(new Date(startIso).getTime() + newSeconds * 1000);
    setEndTime(toTimeStr(newEnd));
    setEndDayOffset(dayOffset(startIso, newEnd.toISOString()));
  }

  async function handleSave() {
    setBusy(true);
    try {
      const patch: EntryPatch = {
        description,
        projectId,
        tagIds,
        start: startIso,
      };
      if (endIso) patch.end = endIso;
      await onSave(entry.id, patch);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    await onDelete(entry.id);
    onClose();
  }

  return (
    <Modal
      title="Modifier le créneau"
      onClose={onClose}
      widthClass="max-w-xl"
      footer={
        <>
          <div className="mr-auto">
            <ActionMenu
              direction="up"
              items={[{ label: "Supprimer", icon: <IconTrash className="w-4 h-4" />, danger: true, onSelect: handleDelete }]}
            />
          </div>
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded text-accent hover:bg-surfaceAlt">
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy || invalidRange}
            className={`px-4 py-2 text-sm uppercase disabled:opacity-50 disabled:cursor-not-allowed ${PRIMARY_BUTTON_CLASS}`}
          >
            Enregistrer
          </button>
        </>
      }
    >
      <div>
        <p className="text-sm text-gray-200 mb-3">Date et heure</p>
        <div className="flex items-center gap-2 flex-wrap">
          {running ? (
            <span className="font-mono text-lg text-gray-100 px-3">{formatDuration(seconds)}</span>
          ) : (
            <DurationInput
              seconds={Math.max(0, seconds)}
              onCommit={handleDurationCommit}
              ariaLabel="Durée"
              className={DURATION_INPUT_CLASS}
            />
          )}
          <TimeInput value={startTime} onChange={setStartTime} ariaLabel="Heure de début" />
          {!running && (
            <>
              <span className="text-muted">-</span>
              <TimeInput value={endTime} onChange={setEndTime} ariaLabel="Heure de fin" />
            </>
          )}
          <input
            type="date"
            aria-label="Date"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={`${INPUT_CLASS} ml-auto`}
          />
        </div>
        {running && <p className="text-xs text-muted mt-2">Ce créneau est en cours : seule l'heure de début est modifiable.</p>}
        {invalidRange && <p className="text-xs text-red-400 mt-2">L'heure de fin doit être après l'heure de début.</p>}
      </div>

      <div className="grid sm:grid-cols-[110px_1fr] gap-x-4 gap-y-4 border-t border-border pt-5">
        <label htmlFor="edit-entry-description" className={LABEL_CLASS}>
          Description
        </label>
        <textarea
          id="edit-entry-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={`${INPUT_CLASS} w-full resize-y`}
        />

        <label htmlFor="edit-entry-project" className={LABEL_CLASS}>
          Projet
        </label>
        <select
          id="edit-entry-project"
          value={projectId ?? ""}
          onChange={(e) => setProjectId(e.target.value || null)}
          className={`${INPUT_CLASS} w-full`}
        >
          <option value="">Aucun projet</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.client ? ` - ${p.client.name}` : ""}
            </option>
          ))}
        </select>

        <span className={LABEL_CLASS}>Balises</span>
        <TagSelect
          tags={tags}
          value={tagIds}
          onChange={setTagIds}
          onCreateTag={onCreateTag}
          emptyLabel="Ajouter les balises"
          buttonClassName={TAG_BUTTON_CLASS}
          fullWidth
        />
      </div>
    </Modal>
  );
}

/** ISO string moved forward by `days` local calendar days. */
function shiftDays(iso: string, days: number): string {
  if (days === 0) return iso;
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
