import { useMemo, useState } from "react";
import { TimeEntry } from "../../api/types";
import { NO_DESCRIPTION_LABEL } from "../../utils/constants";
import { GroupBy, buildDayBars, entrySeconds, groupEntries } from "../../utils/reportData";
import { dateStrOf, formatDuration } from "../../utils/time";
import CountBadge from "../ui/CountBadge";
import ToggleSwitch from "../ui/ToggleSwitch";
import { CARD_CLASS } from "../ui/styles";
import BarChart from "./BarChart";
import DonutChart from "./DonutChart";
import { IconChevronDown, IconTag } from "../icons";

interface Props {
  /** Entries already filtered by the report filters. */
  entries: TimeEntry[];
  rounded: boolean;
  totalSeconds: number;
  loading: boolean;
}

const GROUP_LABELS: Record<GroupBy, string> = { project: "Projet", description: "Description" };

/** "Résumé" tab: per-day bar chart, then a grouped table (by project or description) next to a donut. */
export default function SummaryView({ entries, rounded, totalSeconds, loading }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>("project");
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const dayBars = useMemo(() => buildDayBars(entries, rounded), [entries, rounded]);
  const rows = useMemo(() => groupEntries(entries, groupBy, rounded, sortDesc), [entries, groupBy, rounded, sortDesc]);

  return (
    <>
      <div className={`${CARD_CLASS} p-5 mb-4`}>
        {loading ? (
          <div className="h-[220px] flex items-center justify-center text-muted text-sm">Chargement...</div>
        ) : (
          <BarChart days={dayBars} />
        )}
      </div>

      <div className={CARD_CLASS}>
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
          <span className="text-sm text-muted">Regrouper par :</span>
          <div className="flex items-center gap-1">
            {(Object.keys(GROUP_LABELS) as GroupBy[]).map((g) => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1.5 text-sm rounded ${
                  groupBy === g ? "bg-accent text-white" : "bg-surfaceAlt text-gray-300 hover:text-gray-100"
                }`}
              >
                {GROUP_LABELS[g]}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <ToggleSwitch checked={false} label="Afficher l'estimation" disabled />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between px-4 py-2 text-xs text-muted border-b border-border">
              <span>TITRE</span>
              <button onClick={() => setSortDesc((s) => !s)} className="flex items-center gap-1 hover:text-gray-200">
                DURÉE
                <IconChevronDown className={`w-3 h-3 transition-transform ${sortDesc ? "" : "rotate-180"}`} />
              </button>
            </div>

            {rows.map((row) => (
              <div key={row.key} className="border-b border-border last:border-b-0">
                <div
                  onClick={() => setExpandedKey(expandedKey === row.key ? null : row.key)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surfaceAlt cursor-pointer"
                >
                  <CountBadge count={row.count} />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="text-sm truncate" style={{ color: row.color }}>
                    {row.name}
                  </span>
                  {row.clientName && <span className="text-sm text-muted truncate">- {row.clientName}</span>}
                  <span className="font-mono text-sm text-gray-200 ml-auto shrink-0">{formatDuration(row.seconds)}</span>
                </div>

                {expandedKey === row.key && (
                  <div className="bg-bg/30">
                    {row.entries.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-3 pl-14 pr-4 py-2 text-xs text-muted border-t border-border/50"
                      >
                        <span className="truncate flex-1">{e.description || NO_DESCRIPTION_LABEL}</span>
                        {e.tags.length > 0 && (
                          <span className="flex items-center gap-1 shrink-0">
                            <IconTag className="w-3 h-3" />
                            {e.tags.map((t) => t.name).join(", ")}
                          </span>
                        )}
                        <span className="shrink-0">{dateStrOf(e.start)}</span>
                        <span className="font-mono text-gray-300 shrink-0 w-16 text-right">
                          {formatDuration(entrySeconds(e, rounded))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {rows.length === 0 && (
              <div className="text-center text-muted text-sm py-12">Aucune donnée pour cette période</div>
            )}
          </div>

          {rows.length > 0 && (
            <div className="flex items-center justify-center p-6 lg:w-[260px] shrink-0">
              <DonutChart segments={rows} totalSeconds={totalSeconds} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
