import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { EntryPatch, NewEntryPayload, Project, Tag, TimeEntry } from "../api/types";
import { formatDayLabel, formatDuration, formatWeekLabel } from "../utils/time";
import { groupByWeekAndDay, groupIdenticalEntries } from "../utils/grouping";
import TimerBar from "../components/TimerBar";
import EntryGroup from "../components/EntryGroup";
import { CARD_CLASS } from "../components/ui/styles";

/** "Suivi du temps": timer / manual entry bar plus the history grouped by week and day. */
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

  /** Replaces one entry in the local list with the server's version. */
  function replaceEntry(updated: TimeEntry) {
    setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
  }

  async function handleCreateTag(name: string): Promise<Tag> {
    const res = await api.post("/tags", { name });
    setTags((prev) => [...prev, res.data]);
    return res.data;
  }

  async function handleStart(description: string, projectId: string | null, tagIds: string[], billable: boolean) {
    const res = await api.post("/time-entries/start", { description, projectId, tagIds, billable });
    setRunning(res.data);
    setEntries((prev) => [res.data, ...prev.filter((e) => e.id !== res.data.id)]);
  }

  async function handleStop() {
    if (!running) return;
    const res = await api.post(`/time-entries/${running.id}/stop`);
    setRunning(null);
    replaceEntry(res.data);
  }

  async function handleCreateManual(payload: NewEntryPayload) {
    const res = await api.post("/time-entries", payload);
    setEntries((prev) => [res.data, ...prev]);
  }

  // Restarts a timer with the same description / project / tags as `entry`
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
    replaceEntry(res.data);
    // Editing can stop (end set) or reopen the running entry
    if (running?.id === id) setRunning(res.data.end ? null : res.data);
  }

  if (loading) {
    return <div className="p-8 text-muted text-sm">Chargement...</div>;
  }

  // The running entry lives in the TimerBar, not in the history
  const completedEntries = entries.filter((e) => e.end !== null);
  const weeks = groupByWeekAndDay(completedEntries);

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
        {weeks.map((week) => (
          <div key={week.key}>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm text-gray-300">{formatWeekLabel(week.key)}</span>
              <span className="text-sm text-muted">
                Total semaine : <span className="text-gray-200 font-mono">{formatDuration(week.totalSeconds)}</span>
              </span>
            </div>

            <div className="space-y-4">
              {week.days.map((day) => (
                <div key={day.key} className={CARD_CLASS}>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                    <span className="text-sm text-gray-300 capitalize">{formatDayLabel(day.entries[0].start)}</span>
                    <span className="text-xs text-muted">
                      Total :{" "}
                      <span className="font-mono text-sm text-gray-200">{formatDuration(day.totalSeconds)}</span>
                    </span>
                  </div>
                  {groupIdenticalEntries(day.entries).map((group) => (
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
              ))}
            </div>
          </div>
        ))}

        {completedEntries.length === 0 && (
          <div className="text-center text-muted text-sm py-12">
            Aucune entrée pour le moment. Démarrez le minuteur pour commencer !
          </div>
        )}
      </div>
    </div>
  );
}
