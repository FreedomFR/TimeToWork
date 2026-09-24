import { useEffect, useState } from "react";
import { NewEntryPayload, Project, Tag, TimeEntry } from "../api/types";
import {
  combineDateTime,
  durationSeconds,
  formatDayLabel,
  formatDuration,
  nowTimeStr,
  toTimeStr,
  todayStr,
} from "../utils/time";
import DescriptionInput from "./DescriptionInput";
import ProjectSelect from "./ProjectSelect";
import TagSelect from "./TagSelect";
import BillableToggle from "./BillableToggle";
import TimeInput from "./TimeInput";
import DatePickerButton from "./ui/DatePickerButton";
import DurationInput from "./ui/DurationInput";
import { CARD_CLASS } from "./ui/styles";
import { IconList, IconTimer, IconPlay, IconStop } from "./icons";

interface Props {
  projects: Project[];
  tags: Tag[];
  /** The currently running entry, if any (its fields are mirrored into the bar). */
  running: TimeEntry | null;
  /** Past entries, used for the "recent tasks" suggestions. */
  recentEntries: TimeEntry[];
  onStart: (description: string, projectId: string | null, tagIds: string[], billable: boolean) => Promise<void>;
  onStop: () => Promise<void>;
  onCreateManual: (payload: NewEntryPayload) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag>;
}

type Mode = "timer" | "manual";

const DURATION_INPUT_CLASS =
  "font-mono text-base w-24 text-center bg-transparent border-none text-gray-200 placeholder:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent rounded py-2";

/**
 * Full-width bar at the top of the time tracker, in two modes:
 *  - "timer": start/stop a live timer;
 *  - "manual": log a finished entry with free-form start/end times and date.
 * Switching is locked while a timer runs.
 */
export default function TimerBar({
  projects,
  tags,
  running,
  recentEntries,
  onStart,
  onStop,
  onCreateManual,
  onCreateTag,
}: Props) {
  const [mode, setMode] = useState<Mode>("manual");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [billable, setBillable] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  // Manual-mode fields
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState(nowTimeStr());
  const [endTime, setEndTime] = useState(nowTimeStr());

  // Mirror the running entry into the bar and tick the elapsed counter every second
  useEffect(() => {
    if (!running) {
      setElapsed(0);
      return;
    }
    setMode("timer");
    setDescription(running.description);
    setProjectId(running.projectId);
    setTagIds(running.tags.map((t) => t.id));
    setBillable(running.billable);
    setElapsed(durationSeconds(running.start, null));
    const interval = setInterval(() => setElapsed(durationSeconds(running.start, null)), 1000);
    return () => clearInterval(interval);
  }, [running]);

  function resetFields() {
    setDescription("");
    setProjectId(null);
    setTagIds([]);
    setBillable(false);
  }

  function applySuggestion(entry: TimeEntry) {
    setDescription(entry.description);
    setProjectId(entry.projectId);
  }

  async function handleToggleTimer() {
    setBusy(true);
    try {
      if (running) {
        await onStop();
        resetFields();
      } else {
        await onStart(description, projectId, tagIds, billable);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddManual() {
    setBusy(true);
    try {
      await onCreateManual({
        description,
        projectId,
        tagIds,
        billable,
        start: combineDateTime(date, startTime),
        end: combineDateTime(date, endTime),
      });
      resetFields();
      setDate(todayStr());
      setStartTime(nowTimeStr());
      setEndTime(nowTimeStr());
    } finally {
      setBusy(false);
    }
  }

  // Typing a duration moves the end time, keeping the start fixed
  function handleDurationCommit(seconds: number) {
    const newEnd = new Date(new Date(combineDateTime(date, startTime)).getTime() + seconds * 1000);
    setEndTime(toTimeStr(newEnd));
  }

  const manualStartIso = combineDateTime(date, startTime);
  const manualSeconds = durationSeconds(manualStartIso, combineDateTime(date, endTime));

  return (
    <div className={`${CARD_CLASS} px-3 py-2 flex items-center gap-1 flex-wrap`}>
      <DescriptionInput
        value={description}
        onChange={setDescription}
        onPickSuggestion={applySuggestion}
        recentEntries={recentEntries}
        disabled={!!running && busy}
      />

      <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
      <TagSelect tags={tags} value={tagIds} onChange={setTagIds} onCreateTag={onCreateTag} />
      <BillableToggle value={billable} onChange={setBillable} />

      {mode === "timer" ? (
        <>
          <div className="font-mono text-lg tabular-nums w-24 text-center text-gray-200">{formatDuration(elapsed)}</div>
          <button
            onClick={handleToggleTimer}
            disabled={busy}
            className={`flex items-center gap-2 px-5 py-2 rounded text-sm font-medium text-white transition-colors disabled:opacity-60 ${
              running ? "bg-red-500 hover:bg-red-600" : "bg-accent hover:bg-accentDark"
            }`}
          >
            {running ? <IconStop className="w-3.5 h-3.5" /> : <IconPlay className="w-3.5 h-3.5" />}
            {running ? "ARRÊTER" : "DÉMARRER"}
          </button>
        </>
      ) : (
        <>
          <TimeInput value={startTime} onChange={setStartTime} ariaLabel="Heure de début" />
          <span className="text-muted">-</span>
          <TimeInput value={endTime} onChange={setEndTime} ariaLabel="Heure de fin" />

          <DatePickerButton value={date} onChange={setDate} label={formatDayLabel(manualStartIso)} />

          <DurationInput
            seconds={manualSeconds}
            onCommit={handleDurationCommit}
            ariaLabel="Durée"
            className={DURATION_INPUT_CLASS}
          />

          <button
            onClick={handleAddManual}
            disabled={busy}
            className="px-6 py-2 rounded text-sm font-medium text-white bg-accent hover:bg-accentDark transition-colors disabled:opacity-60 whitespace-nowrap"
          >
            AJOUTER
          </button>
        </>
      )}

      <button
        type="button"
        title={mode === "timer" ? "Passer en saisie manuelle" : "Passer au minuteur"}
        onClick={() => !running && setMode(mode === "timer" ? "manual" : "timer")}
        disabled={!!running}
        className="w-9 h-9 shrink-0 rounded flex items-center justify-center text-muted hover:text-gray-300 hover:bg-surfaceAlt disabled:opacity-30 transition-colors"
      >
        {mode === "manual" ? <IconList /> : <IconTimer />}
      </button>
    </div>
  );
}
