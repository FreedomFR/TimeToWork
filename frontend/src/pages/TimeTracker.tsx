import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { Project, Tag, TimeEntry } from "../api/types";
import { durationSeconds, formatDayLabel, formatDuration, dayKey, weekKey, formatWeekLabel } from "../utils/time";
import TimerBar from "../components/TimerBar";
import EntryGroup from "../components/EntryGroup";
import { EntryPatch } from "../components/EntryRow";

function entryGroupKey(entry: TimeEntry): string {
  const tagKey = [...entry.tags.map((t) => t.id)].sort().join(",");
  return [entry.description, entry.projectId || "", entry.billable, tagKey].join("|");
}

export default function TimeTracker() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [running, setRunning] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [projectsRes, tagsRes, entriesRes, currentRes] = await Promise.all([
      api.get("/projects"),
      api.get("/tags"),
      api.get("/time-entries"),
      api.get("/time-entries/current"),
    ]);
    setProjects(projectsRes.data);
    setTags(tagsRes.data);
    setEntries(entriesRes.data);
    setRunning(currentRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreateTag(name: string): Promise<Tag> {
    const res = await api.post("/tags", { name });
    setTags((prev) => [...prev, res.data]);
    return res.data;
  }

  async function handleStart(
    description: string,
    projectId: string | null,
    tagIds: string[],
    billable: boolean
  ) {
    const res = await api.post("/time-entries/start", { description, projectId, tagIds, billable });
    setRunning(res.data);
    setEntries((prev) => [res.data, ...prev.filter((e) => e.id !== res.data.id)]);
  }

  async function handleStop() {
    if (!running) return;
    const res = await api.post(`/time-entries/${running.id}/stop`);
    setRunning(null);
    setEntries((prev) => prev.map((e) => (e.id === res.data.id ? res.data : e)));
  }

  async function handleCreateManual(payload: {
    description: string;
    projectId: string | null;
    tagIds: string[];
    billable: boolean;
    start: string;
    end: string;
  }) {
    const res = await api.post("/time-entries", payload);
    setEntries((prev) => [res.data, ...prev]);
  }

  async function handleContinue(entry: TimeEntry) {
    if (running) {
      await api.post(`/time-entries/${running.id}/stop`);
    }
    const res = await api.post("/time-entries/start", {
      description: entry.description,
      projectId: entry.projectId,
      tagIds: entry.tags.map((t) => t.id),
      billable: entry.billable,
    });
    setRunning(res.data);
    setEntries((prev) => [res.data, ...prev]);
  }

  async function handleDelete(id: string) {
    await api.delete(`/time-entries/${id}`);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (running?.id === id) setRunning(null);
  }

  async function handleUpdate(id: string, patch: EntryPatch) {
    const res = await api.put(`/time-entries/${id}`, patch);
    setEntries((prev) => prev.map((e) => (e.id === id ? res.data : e)));
    if (running?.id === id) setRunning(res.data.end ? null : res.data);
  }

  const completedEntries = entries.filter((e) => e.end !== null);

  const dayGroups = new Map<string, TimeEntry[]>();
  for (const entry of completedEntries) {
    const key = dayKey(entry.start);
    if (!dayGroups.has(key)) dayGroups.set(key, []);
    dayGroups.get(key)!.push(entry);
  }
  const sortedDays = Array.from(dayGroups.entries()).sort(
    (a, b) => new Date(b[1][0].start).getTime() - new Date(a[1][0].start).getTime()
  );

  const weekGroups = new Map<string, typeof sortedDays>();
  for (const day of sortedDays) {
    const wKey = weekKey(day[1][0].start);
    if (!weekGroups.has(wKey)) weekGroups.set(wKey, []);
    weekGroups.get(wKey)!.push(day);
  }
  const sortedWeeks = Array.from(weekGroups.entries()).sort(
    (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
  );

  if (loading) {
    return <div className="p-8 text-muted text-sm">Chargement...</div>;
  }

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-4">Suivi du temps</h1>

      <TimerBar
        projects={projects}
        tags={tags}
        running={running}
        recentEntries={entries}
        onStart={handleStart}
        onStop={handleStop}
        onCreateManual={handleCreateManual}
        onCreateTag={handleCreateTag}
      />

      <div className="mt-6 space-y-8">
        {sortedWeeks.map(([wKey, days]) => {
          const weekTotal = days.reduce(
            (sum, [, dayEntries]) =>
              sum + dayEntries.reduce((s, e) => s + durationSeconds(e.start, e.end), 0),
            0
          );
          return (
            <div key={wKey}>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm text-gray-300">{formatWeekLabel(wKey)}</span>
                <span className="text-sm text-muted">
                  Total semaine : <span className="text-gray-200 font-mono">{formatDuration(weekTotal)}</span>
                </span>
              </div>

              <div className="space-y-4">
                {days.map(([key, dayEntries]) => {
                  const totalSeconds = dayEntries.reduce(
                    (sum, e) => sum + durationSeconds(e.start, e.end),
                    0
                  );

                  const groups = new Map<string, TimeEntry[]>();
                  for (const entry of dayEntries) {
                    const gKey = entryGroupKey(entry);
                    if (!groups.has(gKey)) groups.set(gKey, []);
                    groups.get(gKey)!.push(entry);
                  }
                  const sortedGroups = Array.from(groups.values()).sort(
                    (a, b) => new Date(b[0].start).getTime() - new Date(a[0].start).getTime()
                  );

                  return (
                    <div key={key} className="bg-surface rounded-lg border border-border">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                        <span className="text-sm text-gray-300 capitalize">
                          {formatDayLabel(dayEntries[0].start)}
                        </span>
                        <span className="text-xs text-muted">
                          Total :{" "}
                          <span className="font-mono text-sm text-gray-200">
                            {formatDuration(totalSeconds)}
                          </span>
                        </span>
                      </div>
                      {sortedGroups.map((group) => (
                        <EntryGroup
                          key={group[0].id}
                          entries={group}
                          projects={projects}
                          tags={tags}
                          onContinue={handleContinue}
                          onDelete={handleDelete}
                          onUpdate={handleUpdate}
                          onCreateTag={handleCreateTag}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {completedEntries.length === 0 && (
          <div className="text-center text-muted text-sm py-12">
            Aucune entrée pour le moment. Démarrez le minuteur pour commencer !
          </div>
        )}
      </div>
    </div>
  );
}
