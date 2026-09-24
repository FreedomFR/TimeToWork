import { useEffect, useMemo, useRef, useState } from "react";
import { Project, Tag, TimeEntry } from "../api/types";
import {
  formatDuration,
  durationSeconds,
  formatDayLabel,
  parseDurationInput,
  combineDateTime,
} from "../utils/time";
import ProjectSelect from "./ProjectSelect";
import TagSelect from "./TagSelect";
import BillableToggle from "./BillableToggle";
import TimeInput from "./TimeInput";
import { IconCalendar, IconList, IconTimer, IconPlay, IconStop } from "./icons";

interface ManualPayload {
  description: string;
  projectId: string | null;
  tagIds: string[];
  billable: boolean;
  start: string;
  end: string;
}

interface Props {
  projects: Project[];
  tags: Tag[];
  running: TimeEntry | null;
  recentEntries: TimeEntry[];
  onStart: (
    description: string,
    projectId: string | null,
    tagIds: string[],
    billable: boolean
  ) => Promise<void>;
  onStop: () => Promise<void>;
  onCreateManual: (payload: ManualPayload) => Promise<void>;
  onCreateTag: (name: string) => Promise<Tag>;
}

const MAX_SUGGESTIONS = 5;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const [mode, setMode] = useState<"timer" | "manual">("manual");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [billable, setBillable] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestBoxRef = useRef<HTMLDivElement>(null);

  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState(nowTimeStr());
  const [endTime, setEndTime] = useState(nowTimeStr());
  const [durationInput, setDurationInput] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

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

  const filteredSuggestions = useMemo(() => {
    const query = description.trim().toLowerCase();
    if (!query) return suggestions;
    return suggestions.filter((s) => s.description.toLowerCase().includes(query));
  }, [suggestions, description]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (suggestBoxRef.current && !suggestBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function applySuggestion(entry: TimeEntry) {
    setDescription(entry.description);
    setProjectId(entry.projectId);
    setShowSuggestions(false);
  }

  useEffect(() => {
    if (running) {
      setMode("timer");
      setDescription(running.description);
      setProjectId(running.projectId);
      setTagIds(running.tags.map((t) => t.id));
      setBillable(running.billable);
      setElapsed(durationSeconds(running.start, null));
      const interval = setInterval(() => {
        setElapsed(durationSeconds(running.start, null));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsed(0);
    }
  }, [running]);

  function resetFields() {
    setDescription("");
    setProjectId(null);
    setTagIds([]);
    setBillable(false);
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
      setDurationInput("");
    } finally {
      setBusy(false);
    }
  }

  function handleDurationBlur() {
    const seconds = parseDurationInput(durationInput);
    setDurationInput("");
    if (seconds === null) return;
    const startIso = combineDateTime(date, startTime);
    const newEnd = new Date(new Date(startIso).getTime() + seconds * 1000);
    setEndTime(`${pad(newEnd.getHours())}:${pad(newEnd.getMinutes())}`);
  }

  const manualSeconds = Math.max(0, durationSeconds(combineDateTime(date, startTime), combineDateTime(date, endTime)));
  const dateLabel = formatDayLabel(combineDateTime(date, startTime));

  return (
    <div className="bg-surface rounded-lg border border-border px-3 py-2 flex items-center gap-1 flex-wrap">
      <div className="relative flex-1 min-w-[160px]" ref={suggestBoxRef}>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Sur quoi avez-vous travaillé ?"
          disabled={!!running && busy}
          className="w-full bg-transparent border-none focus:outline-none text-sm px-2 py-2 text-gray-200 placeholder:text-muted"
        />

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-20 mt-1 left-0 w-96 max-w-[90vw] bg-surface border border-border rounded shadow-lg overflow-hidden">
            <div className="px-3 py-1.5 text-xs text-muted border-b border-border">
              Tâches récentes
            </div>
            {filteredSuggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => applySuggestion(s)}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-surfaceAlt"
              >
                <span className="text-gray-200 truncate flex-1 min-w-0">{s.description}</span>
                {s.project && (
                  <span
                    className="flex items-center gap-1.5 text-xs shrink-0"
                    style={{ color: s.project.color }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: s.project.color }}
                    />
                    {s.project.name}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
      <TagSelect tags={tags} value={tagIds} onChange={setTagIds} onCreateTag={onCreateTag} />
      <BillableToggle value={billable} onChange={setBillable} />

      {mode === "timer" ? (
        <>
          <div className="font-mono text-lg tabular-nums w-24 text-center text-gray-200">
            {formatDuration(elapsed)}
          </div>
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

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker?.() ?? dateInputRef.current?.focus()}
              className="flex items-center gap-1.5 px-2.5 py-2 text-sm rounded hover:bg-surfaceAlt text-gray-300 whitespace-nowrap"
            >
              <IconCalendar className="w-4 h-4 text-muted" />
              {dateLabel}
            </button>
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
            />
          </div>

          <input
            value={durationInput}
            onChange={(e) => setDurationInput(e.target.value)}
            onBlur={handleDurationBlur}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            placeholder={formatDuration(manualSeconds)}
            aria-label="Durée"
            className="font-mono text-base w-24 text-center bg-transparent border-none text-gray-200 placeholder:text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent rounded py-2"
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
