import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { EntryPatch, Project, Tag, TimeEntry } from "../api/types";
import { useTimeEntries } from "../hooks/useTimeEntries";
import { buildCalendarDays, daysFrom } from "../utils/calendar";
import { PeriodUnit, periodRange } from "../utils/time";
import CalendarGrid from "../components/calendar/CalendarGrid";
import EditEntryDialog from "../components/calendar/EditEntryDialog";
import PeriodPicker from "../components/reports/PeriodPicker";
import ScopeBadge from "../components/ui/ScopeBadge";

type View = "week" | "day";

const VIEW_LABELS: Record<View, string> = { week: "Semaine", day: "Jour" };

/** Zoom levels in pixels per hour; the calendar starts at 60 (index 2). */
const HOUR_HEIGHTS = [30, 45, 60, 90, 120];
const DEFAULT_ZOOM_INDEX = 2;

/**
 * Calendar view: the week (Monday–Sunday) or a single day laid out on a time grid,
 * each entry drawn as a block at its real start time with a height proportional to
 * its duration. Overlapping entries sit side by side. Clicking a block opens the
 * "Modifier le créneau" dialog to edit or delete the entry.
 */
export default function Calendar() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

  // The view doubles as the period unit ("week" / "day"), so the picker's arrows step accordingly
  const unit: PeriodUnit = view;
  const [from, to] = periodRange(unit, anchor);
  const { entries, setEntries, loading } = useTimeEntries(from, to);

  // Data needed by the edit dialog
  const [projects, setProjects] = useState<Project[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [editing, setEditing] = useState<TimeEntry | null>(null);

  useEffect(() => {
    Promise.all([api.get("/projects"), api.get("/tags")]).then(([p, t]) => {
      setProjects(p.data);
      setTags(t.data);
    });
  }, []);

  async function handleSave(id: string, patch: EntryPatch) {
    const res = await api.put(`/time-entries/${id}`, patch);
    setEntries((prev) => prev.map((e) => (e.id === id ? res.data : e)));
  }

  async function handleDelete(id: string) {
    await api.delete(`/time-entries/${id}`);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleCreateTag(name: string): Promise<Tag> {
    const res = await api.post("/tags", { name });
    setTags((prev) => [...prev, res.data]);
    return res.data;
  }

  const days = useMemo(
    () => buildCalendarDays(entries, daysFrom(from, view === "week" ? 7 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, from.getTime(), view]
  );

  return (
    <div className="px-6 py-6 h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center rounded border border-border bg-surface overflow-hidden">
          <span className="px-3 py-2 text-xs font-medium tracking-wide text-gray-100">CALENDRIER</span>
          {(Object.keys(VIEW_LABELS) as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-3 py-2 text-sm border-l border-border transition-colors ${
                view === v ? "bg-surfaceAlt text-gray-100" : "text-muted hover:text-gray-200"
              }`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <ScopeBadge />
          <PeriodPicker
            // Remount when switching view so the dropdown closes and shows the right presets
            key={view}
            unit={unit}
            anchor={anchor}
            customRange={null}
            allowedUnits={[unit]}
            onChangePreset={(_, a) => setAnchor(a)}
            onChangeCustom={() => {}}
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-muted text-sm">Chargement...</div>
      ) : (
        <CalendarGrid
          days={days}
          hourHeight={HOUR_HEIGHTS[zoomIndex]}
          canZoomIn={zoomIndex < HOUR_HEIGHTS.length - 1}
          canZoomOut={zoomIndex > 0}
          onZoomIn={() => setZoomIndex((i) => Math.min(HOUR_HEIGHTS.length - 1, i + 1))}
          onZoomOut={() => setZoomIndex((i) => Math.max(0, i - 1))}
          onSelectEntry={setEditing}
        />
      )}

      {editing && (
        <EditEntryDialog
          key={editing.id}
          entry={editing}
          projects={projects}
          tags={tags}
          onSave={handleSave}
          onDelete={handleDelete}
          onCreateTag={handleCreateTag}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
