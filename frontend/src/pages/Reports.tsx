import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Client, Project, Tag, TimeEntry } from "../api/types";
import {
  PeriodUnit,
  dateStrOf,
  durationSeconds,
  formatDateRangeLabel,
  formatDuration,
  formatPeriodLabel,
  periodRange,
  roundToQuarterHour,
} from "../utils/time";
import PeriodPicker, { CustomRange } from "../components/reports/PeriodPicker";
import MultiSelectFilter from "../components/reports/MultiSelectFilter";
import BarChart, { DayBar } from "../components/reports/BarChart";
import DonutChart from "../components/reports/DonutChart";
import DetailedTable from "../components/reports/DetailedTable";
import ExportDialog from "../components/reports/ExportDialog";
import WeeklyTable, { WEEKLY_GROUP_LABELS, WeeklyGroupBy } from "../components/reports/WeeklyTable";
import {
  IconChevronDown,
  IconDownload,
  IconFilter,
  IconPrint,
  IconShare,
  IconTag,
} from "../components/icons";

const NEUTRAL_COLOR = "#8b93a7";
const TABS = ["Résumé", "Détaillé", "Hebdomadaire", "Partagé"] as const;
type GroupBy = "project" | "description";

interface GroupRow {
  key: string;
  name: string;
  clientName: string | null;
  color: string;
  seconds: number;
  count: number;
  entries: TimeEntry[];
}

function DescriptionFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen((o) => !o);
        }}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded hover:bg-surfaceAlt whitespace-nowrap ${
          value ? "text-gray-100" : "text-gray-300"
        }`}
      >
        Description
        <IconChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 w-64 bg-surface border border-border rounded shadow-lg p-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onChange(draft);
                setOpen(false);
              }
            }}
            placeholder="Contient..."
            className="w-full bg-surfaceAlt border-none rounded px-2 py-1.5 text-sm text-gray-200 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={() => {
              onChange(draft);
              setOpen(false);
            }}
            className="w-full mt-2 bg-accent hover:bg-accentDark text-white text-xs font-medium rounded py-1.5"
          >
            Appliquer
          </button>
        </div>
      )}
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Résumé");
  const [unit, setUnit] = useState<PeriodUnit>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const [weeklyGroupBy, setWeeklyGroupBy] = useState<WeeklyGroupBy>("project");

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("project");
  const [rounded, setRounded] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);

  const [from, to] =
    tab === "Hebdomadaire"
      ? periodRange("week", weekAnchor)
      : customRange
        ? [customRange.from, customRange.to]
        : periodRange(unit, anchor);

  useEffect(() => {
    Promise.all([api.get("/projects"), api.get("/clients"), api.get("/tags")]).then(
      ([p, c, t]) => {
        setProjects(p.data);
        setClients(c.data);
        setTags(t.data);
      }
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get("/time-entries", { params: { from: from.toISOString(), to: to.toISOString() } })
      .then((res) => setEntries(res.data))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.getTime(), to.getTime()]);

  const filtered = useMemo(() => {
    const q = description.trim().toLowerCase();
    return entries.filter((e) => {
      if (e.end === null) return false;
      if (projectIds.length > 0 && !(e.projectId && projectIds.includes(e.projectId))) return false;
      if (clientIds.length > 0 && !(e.project?.clientId && clientIds.includes(e.project.clientId)))
        return false;
      if (tagIds.length > 0 && !e.tags.some((t) => tagIds.includes(t.id))) return false;
      if (q && !e.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, projectIds, clientIds, tagIds, description]);

  function entrySeconds(e: TimeEntry) {
    const s = durationSeconds(e.start, e.end);
    return rounded ? roundToQuarterHour(s) : s;
  }

  const totalSeconds = useMemo(
    () => filtered.reduce((sum, e) => sum + entrySeconds(e), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, rounded]
  );

  const dayBars: DayBar[] = useMemo(() => {
    const byDay = new Map<string, Map<string, { color: string; seconds: number }>>();
    for (const e of filtered) {
      const dayKey = dateStrOf(e.start);
      if (!byDay.has(dayKey)) byDay.set(dayKey, new Map());
      const projKey = e.projectId || "none";
      const projMap = byDay.get(dayKey)!;
      const color = e.project?.color || NEUTRAL_COLOR;
      const current = projMap.get(projKey) || { color, seconds: 0 };
      current.seconds += entrySeconds(e);
      projMap.set(projKey, current);
    }
    return Array.from(byDay.entries())
      .map(([date, projMap]) => {
        const segments = Array.from(projMap.values());
        return { date, segments, totalSeconds: segments.reduce((s, x) => s + x.seconds, 0) };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, rounded]);

  const groupedRows: GroupRow[] = useMemo(() => {
    const groups = new Map<string, GroupRow>();
    for (const e of filtered) {
      const key = groupBy === "project" ? e.projectId || "none" : e.description || "(sans description)";
      const existing = groups.get(key);
      if (existing) {
        existing.seconds += entrySeconds(e);
        existing.count += 1;
        existing.entries.push(e);
      } else {
        groups.set(key, {
          key,
          name: groupBy === "project" ? e.project?.name || "Aucun projet" : e.description || "(sans description)",
          clientName: e.project?.client?.name || null,
          color: e.project?.color || NEUTRAL_COLOR,
          seconds: entrySeconds(e),
          count: 1,
          entries: [e],
        });
      }
    }
    const rows = Array.from(groups.values());
    rows.sort((a, b) => (sortDesc ? b.seconds - a.seconds : a.seconds - b.seconds));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, groupBy, sortDesc, rounded]);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const periodLabel =
    tab === "Hebdomadaire" || customRange
      ? formatDateRangeLabel(from, to)
      : formatPeriodLabel(unit, anchor);

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

  async function handleContinueEntry(entry: TimeEntry) {
    await api.post("/time-entries/start", {
      description: entry.description,
      projectId: entry.projectId,
      tagIds: entry.tags.map((t) => t.id),
      billable: entry.billable,
    });
    navigate("/");
  }

  const projectOptions = projects.map((p) => ({ id: p.id, label: p.name, color: p.color }));
  const clientOptions = clients.map((c) => ({ id: c.id, label: c.name }));
  const tagOptions = tags.map((t) => ({ id: t.id, label: t.name }));

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
          {tab === "Hebdomadaire" ? (
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
        <div className="bg-surface rounded-lg border border-border p-12 text-center text-muted text-sm">
          Cette vue n'est pas encore disponible.
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-lg border border-border px-4 py-2 mb-4 flex items-center gap-1 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-muted pr-2 border-r border-border mr-1">
              <IconFilter className="w-3.5 h-3.5" />
              FILTRER
            </span>
            <button disabled className="px-3 py-2 text-sm text-muted/60 cursor-not-allowed whitespace-nowrap">
              Équipe
            </button>
            <MultiSelectFilter label="Client" options={clientOptions} value={clientIds} onChange={setClientIds} />
            <MultiSelectFilter label="Projet" options={projectOptions} value={projectIds} onChange={setProjectIds} />
            <button disabled className="px-3 py-2 text-sm text-muted/60 cursor-not-allowed whitespace-nowrap">
              Tâche
            </button>
            <MultiSelectFilter label="Balise" options={tagOptions} value={tagIds} onChange={setTagIds} />
            <DescriptionFilter value={description} onChange={setDescription} />
            <div className="ml-auto">
              <button
                onClick={() => {}}
                className="px-4 py-2 text-sm font-medium rounded bg-accent hover:bg-accentDark text-white whitespace-nowrap"
              >
                APPLIQUER LE FILTRE
              </button>
            </div>
          </div>

          <div className="bg-surface rounded-lg border border-border px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-3">
            <span className="text-sm text-muted">
              Total : <span className="font-mono text-2xl text-gray-100 ml-2">{formatDuration(totalSeconds)}</span>
            </span>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted/50 cursor-not-allowed" title="Non disponible">
                Créer une facture
              </span>
              <button onClick={() => window.print()} title="Imprimer" className="text-muted hover:text-gray-200">
                <IconPrint />
              </button>
              <button title="Non disponible" className="text-muted/50 cursor-not-allowed">
                <IconShare />
              </button>
              <label
                className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none"
                onClick={() => setRounded((r) => !r)}
              >
                <span
                  className={`w-9 h-5 rounded-full relative transition-colors ${rounded ? "bg-accent" : "bg-surfaceAlt"}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      rounded ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
                Arrondi
              </label>
              {tab === "Hebdomadaire" && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  Regrouper par :
                  <select
                    aria-label="Regrouper par"
                    value={weeklyGroupBy}
                    onChange={(e) => setWeeklyGroupBy(e.target.value as WeeklyGroupBy)}
                    className="bg-surfaceAlt border-none rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {(Object.keys(WEEKLY_GROUP_LABELS) as WeeklyGroupBy[]).map((g) => (
                      <option key={g} value={g}>
                        {WEEKLY_GROUP_LABELS[g]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </div>

          {tab === "Hebdomadaire" ? (
            loading ? (
              <div className="bg-surface rounded-lg border border-border p-12 text-center text-muted text-sm">
                Chargement...
              </div>
            ) : (
              <WeeklyTable entries={filtered} weekStart={from} rounded={rounded} groupBy={weeklyGroupBy} />
            )
          ) : tab === "Détaillé" ? (
            loading ? (
              <div className="bg-surface rounded-lg border border-border p-12 text-center text-muted text-sm">
                Chargement...
              </div>
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
            )
          ) : (
          <>
          <div className="bg-surface rounded-lg border border-border p-5 mb-4">
            {loading ? (
              <div className="h-[220px] flex items-center justify-center text-muted text-sm">Chargement...</div>
            ) : (
              <BarChart days={dayBars} />
            )}
          </div>

          <div className="bg-surface rounded-lg border border-border">
            <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
              <span className="text-sm text-muted">Regrouper par :</span>
              <div className="flex items-center gap-1">
                {(["project", "description"] as GroupBy[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`px-3 py-1.5 text-sm rounded ${
                      groupBy === g ? "bg-accent text-white" : "bg-surfaceAlt text-gray-300 hover:text-gray-100"
                    }`}
                  >
                    {g === "project" ? "Projet" : "Description"}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm text-muted/50 ml-auto cursor-not-allowed select-none">
                <span className="w-9 h-5 rounded-full bg-surfaceAlt relative">
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-gray-500" />
                </span>
                Afficher l'estimation
              </label>
            </div>

            <div className="flex flex-col lg:flex-row">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between px-4 py-2 text-xs text-muted border-b border-border">
                  <span>TITRE</span>
                  <button
                    onClick={() => setSortDesc((s) => !s)}
                    className="flex items-center gap-1 hover:text-gray-200"
                  >
                    DURÉE
                    <IconChevronDown className={`w-3 h-3 transition-transform ${sortDesc ? "" : "rotate-180"}`} />
                  </button>
                </div>

                {groupedRows.map((row) => (
                  <div key={row.key} className="border-b border-border last:border-b-0">
                    <div
                      onClick={() => setExpandedKey(expandedKey === row.key ? null : row.key)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-surfaceAlt cursor-pointer"
                    >
                      <span className="w-6 h-6 shrink-0 rounded bg-surfaceAlt text-muted text-xs font-medium flex items-center justify-center">
                        {row.count}
                      </span>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                      <span className="text-sm truncate" style={{ color: row.color }}>
                        {row.name}
                      </span>
                      {row.clientName && (
                        <span className="text-sm text-muted truncate">- {row.clientName}</span>
                      )}
                      <span className="font-mono text-sm text-gray-200 ml-auto shrink-0">
                        {formatDuration(row.seconds)}
                      </span>
                    </div>

                    {expandedKey === row.key && (
                      <div className="bg-bg/30">
                        {row.entries.map((e) => (
                          <div
                            key={e.id}
                            className="flex items-center gap-3 pl-14 pr-4 py-2 text-xs text-muted border-t border-border/50"
                          >
                            <span className="truncate flex-1">{e.description || "(sans description)"}</span>
                            {e.tags.length > 0 && (
                              <span className="flex items-center gap-1 shrink-0">
                                <IconTag className="w-3 h-3" />
                                {e.tags.map((t) => t.name).join(", ")}
                              </span>
                            )}
                            <span className="shrink-0">{dateStrOf(e.start)}</span>
                            <span className="font-mono text-gray-300 shrink-0 w-16 text-right">
                              {formatDuration(entrySeconds(e))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {groupedRows.length === 0 && (
                  <div className="text-center text-muted text-sm py-12">
                    Aucune donnée pour cette période
                  </div>
                )}
              </div>

              {groupedRows.length > 0 && (
                <div className="flex items-center justify-center p-6 lg:w-[260px] shrink-0">
                  <DonutChart segments={groupedRows} totalSeconds={totalSeconds} />
                </div>
              )}
            </div>
          </div>
          </>
          )}
        </>
      )}
    </div>
  );
}
