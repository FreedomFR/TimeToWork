import { useMemo, useState } from "react";
import { useTimeEntries } from "../hooks/useTimeEntries";
import { PeriodUnit, formatDuration, periodRange } from "../utils/time";
import { computeDashboard } from "../utils/dashboard";
import PeriodPicker, { CustomRange } from "../components/reports/PeriodPicker";
import DonutChart from "../components/reports/DonutChart";
import DashboardBarChart from "../components/dashboard/DashboardBarChart";
import ScopeBadge from "../components/ui/ScopeBadge";

const TOP_OPTIONS = [5, 10, 20];

/** `75` → `"75,00%"` (French decimal comma). */
function formatPercent(p: number): string {
  return `${p.toFixed(2).replace(".", ",")}%`;
}

/**
 * Dashboard (Clockify-style): KPIs, per-day bar chart, per-project breakdown and
 * the most tracked activities for the selected period (this week by default).
 */
export default function Dashboard() {
  const [unit, setUnit] = useState<PeriodUnit>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [customRange, setCustomRange] = useState<CustomRange | null>(null);
  const [topN, setTopN] = useState(10);

  const [from, to] = customRange ? [customRange.from, customRange.to] : periodRange(unit, anchor);
  const { entries, loading } = useTimeEntries(from, to);

  const stats = useMemo(
    () => computeDashboard(entries, from, to),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, from.getTime(), to.getTime()]
  );

  return (
    <div className="px-6 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-100">Tableau de bord</h1>
        <div className="flex items-center gap-3">
          <ScopeBadge />
          <PeriodPicker
            unit={unit}
            anchor={anchor}
            customRange={customRange}
            onChangePreset={(u, a) => {
              setCustomRange(null);
              setUnit(u);
              setAnchor(a);
            }}
            onChangeCustom={setCustomRange}
          />
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full bg-surface rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 bg-bg/60 border-b border-border">
            <Kpi label="Temps total" value={formatDuration(stats.totalSeconds)} testId="kpi-total" mono />
            <Kpi label="Projet principal" value={stats.topProject ?? "—"} testId="kpi-project" />
            <Kpi label="Principal Client" value={stats.topClient ?? "—"} testId="kpi-client" />
          </div>

          {loading ? (
            <div className="h-[420px] flex items-center justify-center text-muted text-sm">Chargement...</div>
          ) : (
            <>
              <div className="px-4 pt-8 pb-6">
                <DashboardBarChart buckets={stats.buckets} />
              </div>

              <div className="border-t border-border px-6 py-8 flex flex-col lg:flex-row items-center gap-8">
                {stats.totalSeconds > 0 ? (
                  <>
                    <DonutChart
                      size={240}
                      totalSeconds={stats.totalSeconds}
                      segments={stats.shares.map((s) => ({ color: s.color, seconds: s.seconds }))}
                    />
                    <ul className="flex-1 min-w-0 w-full space-y-3" aria-label="Répartition par projet">
                      {stats.shares.map((s) => (
                        <li key={s.key} className="flex items-center gap-3 text-sm">
                          <span className="w-36 shrink-0 text-right truncate text-gray-200">
                            {s.name}
                            {s.clientName && <span className="text-muted"> - {s.clientName}</span>}
                          </span>
                          <span className="w-[4.5rem] shrink-0 font-mono text-gray-200">{formatDuration(s.seconds)}</span>
                          <span className="flex-1 min-w-0 h-6 bg-bg rounded-sm overflow-hidden">
                            <span
                              className="block h-full"
                              style={{ width: `${s.percent}%`, backgroundColor: s.color }}
                            />
                          </span>
                          <span className="w-14 shrink-0 text-muted">{formatPercent(s.percent)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="w-full text-center text-muted text-sm">Aucune donnée pour cette période</p>
                )}
              </div>
            </>
          )}
        </div>

        <aside className="w-full xl:w-[420px] shrink-0 bg-surface rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-bg/60 border-b border-border">
            <h2 className="text-xs text-muted">Activités les plus suivies</h2>
            <select
              aria-label="Nombre d'activités"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="bg-transparent text-xs text-gray-200 focus:outline-none cursor-pointer"
            >
              {TOP_OPTIONS.map((n) => (
                <option key={n} value={n} className="bg-surface">
                  Les {n} meilleurs
                </option>
              ))}
            </select>
          </div>

          {stats.activities.length === 0 ? (
            <p className="px-5 py-8 text-center text-muted text-sm">Aucune activité pour cette période</p>
          ) : (
            <ol aria-label="Activités les plus suivies">
              {stats.activities.slice(0, topN).map((a) => (
                <li key={a.key} className="flex items-center gap-4 px-5 py-3 border-b border-border last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-100 truncate" title={a.description}>
                      {a.description}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted mt-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                      <span className="truncate">
                        {a.projectName ?? "Aucun projet"}
                        {a.clientName && ` - ${a.clientName}`}
                      </span>
                    </p>
                  </div>
                  <span className="font-mono text-sm text-gray-200 shrink-0">{formatDuration(a.seconds)}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}

/** One headline figure of the top strip. */
function Kpi({ label, value, testId, mono }: { label: string; value: string; testId: string; mono?: boolean }) {
  return (
    <div className="px-6 py-4 text-center sm:border-r border-border last:border-r-0">
      <p className="text-xs text-muted">{label}</p>
      <p
        data-testid={testId}
        className={`mt-1 text-2xl text-gray-100 truncate ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
