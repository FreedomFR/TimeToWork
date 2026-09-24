import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Client, Project, Tag, TimeEntry } from "../api/types";
import { useTimeEntries } from "../hooks/useTimeEntries";
import { EntryFilters, entrySeconds, filterEntries } from "../utils/reportData";
import { PeriodUnit, formatDateRangeLabel, formatPeriodLabel, periodRange } from "../utils/time";
import PeriodPicker, { CustomRange } from "../components/reports/PeriodPicker";
import FilterBar from "../components/reports/FilterBar";
import TotalBar from "../components/reports/TotalBar";
import SummaryView from "../components/reports/SummaryView";
import DetailedTable from "../components/reports/DetailedTable";
import WeeklyTable, { WeeklyGroupBy } from "../components/reports/WeeklyTable";
import ExportDialog from "../components/reports/ExportDialog";
import MessageCard from "../components/ui/MessageCard";
import { IconDownload } from "../components/icons";

const TABS = ["Résumé", "Détaillé", "Hebdomadaire", "Partagé"] as const;
type Tab = (typeof TABS)[number];

const NO_FILTERS: EntryFilters = { projectIds: [], clientIds: [], tagIds: [], description: "" };

/**
 * Reports page (Clockify-style). Owns everything the tabs share: period, filters,
 * rounding, the loaded entries and the export dialog; each tab only renders them differently.
 *
 * The weekly tab has its own period (`weekAnchor`, always one Monday–Sunday week)
 * so navigating weeks there never disturbs the period chosen for the other tabs.
 */
export default function Reports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("Résumé");

  // Period of the Résumé / Détaillé tabs: a preset (unit + anchor) or a custom range
  const [unit, setUnit] = useState<PeriodUnit>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  // Period of the Hebdomadaire tab
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [weeklyGroupBy, setWeeklyGroupBy] = useState<WeeklyGroupBy>("project");

  const [filters, setFilters] = useState<EntryFilters>(NO_FILTERS);
  const [rounded, setRounded] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const isWeekly = tab === "Hebdomadaire";
  const [from, to] = isWeekly
    ? periodRange("week", weekAnchor)
    : customRange
      ? [customRange.from, customRange.to]
      : periodRange(unit, anchor);
  const periodLabel = isWeekly || customRange ? formatDateRangeLabel(from, to) : formatPeriodLabel(unit, anchor);

  const { entries, setEntries, loading } = useTimeEntries(from, to);

  useEffect(() => {
    Promise.all([api.get("/projects"), api.get("/clients"), api.get("/tags")]).then(([p, c, t]) => {
      setProjects(p.data);
      setClients(c.data);
      setTags(t.data);
    });
  }, []);

  const filtered = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const totalSeconds = useMemo(
    () => filtered.reduce((sum, e) => sum + entrySeconds(e, rounded), 0),
    [filtered, rounded]
  );

  // ─── Actions used by the detailed table ──────────────────────────────────

  async function handleCreateTag(name: string): Promise<Tag> {
    const res = await api.post("/tags", { name });
    setTags((prev) => [...prev, res.data]);
    return res.data;
  }

  async function handleUpdateTags(id: string, tagIds: string[]) {
    const res = await api.put(`/time-entries/${id}`, { tagIds });
    setEntries((prev) => prev.map((e) => (e.id === id ? res.data : e)));
  }

  async function handleDeleteEntry(id: string) {
    await api.delete(`/time-entries/${id}`);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleDeleteMany(ids: string[]) {
    await Promise.all(ids.map((id) => api.delete(`/time-entries/${id}`)));
    setEntries((prev) => prev.filter((e) => !ids.includes(e.id)));
  }

  // Starts a timer copied from `entry`, then jumps to the time tracker to show it
  async function handleContinueEntry(entry: TimeEntry) {
    await api.post("/time-entries/start", {
      description: entry.description,
      projectId: entry.projectId,
      tagIds: entry.tags.map((t) => t.id),
      billable: entry.billable,
    });
    navigate("/");
  }

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-gray-100 tracking-wide">RAPPORT DE TEMPS</span>
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  tab === t ? "bg-surfaceAlt text-gray-100" : "text-muted hover:text-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isWeekly ? (
            <PeriodPicker
              key="week-picker"
              weekOnly
              unit="week"
              anchor={weekAnchor}
              customRange={null}
              onChangePreset={(_, a) => setWeekAnchor(a)}
              onChangeCustom={() => {}}
            />
          ) : (
            <PeriodPicker
              key="range-picker"
              unit={unit}
              anchor={anchor}
              customRange={customRange}
              onChangePreset={(u, a) => {
                setUnit(u);
                setAnchor(a);
                setCustomRange(null);
              }}
              onChangeCustom={setCustomRange}
            />
          )}
          <button
            onClick={() => setExportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded bg-accent hover:bg-accentDark text-white whitespace-nowrap"
          >
            <IconDownload className="w-4 h-4" />
            EXPORTATION
          </button>
        </div>
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entries={filtered}
        rounded={rounded}
        userName={user?.name || ""}
        periodLabel={periodLabel}
        from={from}
        to={to}
      />

      {tab === "Partagé" ? (
        <MessageCard>Cette vue n'est pas encore disponible.</MessageCard>
      ) : (
        <>
          <FilterBar clients={clients} projects={projects} tags={tags} filters={filters} onChange={setFilters} />

          <TotalBar
            totalSeconds={totalSeconds}
            rounded={rounded}
            onRoundedChange={setRounded}
            weeklyGroupBy={isWeekly ? { value: weeklyGroupBy, onChange: setWeeklyGroupBy } : undefined}
          />

          {tab === "Résumé" && (
            <SummaryView entries={filtered} rounded={rounded} totalSeconds={totalSeconds} loading={loading} />
          )}

          {tab === "Détaillé" &&
            (loading ? (
              <MessageCard>Chargement...</MessageCard>
            ) : (
              <DetailedTable
                entries={filtered}
                tags={tags}
                userName={user?.name || ""}
                onUpdateTags={handleUpdateTags}
                onCreateTag={handleCreateTag}
                onDelete={handleDeleteEntry}
                onDeleteMany={handleDeleteMany}
                onContinue={handleContinueEntry}
              />
            ))}

          {isWeekly &&
            (loading ? (
              <MessageCard>Chargement...</MessageCard>
            ) : (
              <WeeklyTable entries={filtered} weekStart={from} rounded={rounded} groupBy={weeklyGroupBy} />
            ))}
        </>
      )}
    </div>
  );
}
