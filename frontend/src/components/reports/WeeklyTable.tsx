import { useMemo } from "react";
import { TimeEntry } from "../../api/types";
import { NEUTRAL_COLOR, NO_DESCRIPTION_LABEL, NO_PROJECT_LABEL } from "../../utils/constants";
import { entrySeconds } from "../../utils/reportData";
import { dateStrOf, formatDuration } from "../../utils/time";
import CountBadge from "../ui/CountBadge";
import { CARD_CLASS } from "../ui/styles";

export type WeeklyGroupBy = "project" | "client" | "description";

export const WEEKLY_GROUP_LABELS: Record<WeeklyGroupBy, string> = {
  project: "Projet",
  client: "Client",
  description: "Description",
};

interface Props {
  entries: TimeEntry[];
  weekStart: Date;
  rounded: boolean;
  groupBy: WeeklyGroupBy;
}

interface Row {
  key: string;
  name: string;
  clientName: string | null;
  color: string;
  count: number;
  perDay: number[];
  total: number;
}

function dayHeader(d: Date): string {
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
  const month = d.toLocaleDateString("fr-FR", { month: "short" });
  return `${weekday}, ${month} ${d.getDate()}`;
}

/**
 * Weekly report: one row per project / client / description, one column per day of
 * the week (Monday to Sunday) plus row and column totals.
 */
export default function WeeklyTable({ entries, weekStart, rounded, groupBy }: Props) {
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart]
  );

  const { rows, dayTotals, grandTotal } = useMemo(() => {
    const dayKeys = days.map((d) => dateStrOf(d.toISOString()));
    const groups = new Map<string, Row>();

    for (const e of entries) {
      const dayIndex = dayKeys.indexOf(dateStrOf(e.start));
      if (dayIndex === -1) continue;

      let key: string;
      let name: string;
      let color = e.project?.color || NEUTRAL_COLOR;
      let clientName: string | null = e.project?.client?.name || null;

      if (groupBy === "project") {
        key = e.projectId || "none";
        name = e.project?.name || NO_PROJECT_LABEL;
      } else if (groupBy === "client") {
        key = e.project?.clientId || "none";
        name = e.project?.client?.name || "Sans client";
        color = NEUTRAL_COLOR;
        clientName = null;
      } else {
        key = e.description || NO_DESCRIPTION_LABEL;
        name = e.description || NO_DESCRIPTION_LABEL;
      }

      const seconds = entrySeconds(e, rounded);

      const row = groups.get(key) || {
        key,
        name,
        clientName,
        color,
        count: 0,
        perDay: Array(7).fill(0),
        total: 0,
      };
      row.count += 1;
      row.perDay[dayIndex] += seconds;
      row.total += seconds;
      groups.set(key, row);
    }

    const list = Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const dayTotals = days.map((_, i) => list.reduce((s, r) => s + r.perDay[i], 0));
    return { rows: list, dayTotals, grandTotal: dayTotals.reduce((s, t) => s + t, 0) };
  }, [entries, days, groupBy, rounded]);

  if (rows.length === 0) {
    return (
      <div className={`${CARD_CLASS} p-12 text-center text-muted text-sm`}>
        Aucune donnée pour cette période
      </div>
    );
  }

  const cell = (seconds: number) =>
    seconds > 0 ? (
      <span className="font-mono text-gray-200">{formatDuration(seconds)}</span>
    ) : (
      <span className="text-muted">—</span>
    );

  return (
    <div className={`${CARD_CLASS} overflow-x-auto`}>
      <table className="w-full text-sm min-w-[880px]">
        <thead>
          <tr className="text-xs text-muted border-b border-border">
            <th scope="col" className="text-left font-normal px-4 py-3 uppercase">{WEEKLY_GROUP_LABELS[groupBy]}</th>
            {days.map((d) => (
              <th scope="col" key={d.toISOString()} className="text-right font-normal px-3 py-3 whitespace-nowrap">
                {dayHeader(d)}
              </th>
            ))}
            <th scope="col" className="text-right font-normal px-4 py-3">Total :</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-border hover:bg-surfaceAlt">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CountBadge count={row.count} />
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="truncate" style={{ color: row.color }}>
                    {row.name}
                  </span>
                  {row.clientName && <span className="text-muted truncate">- {row.clientName}</span>}
                </div>
              </td>
              {row.perDay.map((s, i) => (
                <td key={i} className="text-right px-3 py-3 whitespace-nowrap">
                  {cell(s)}
                </td>
              ))}
              <td className="text-right px-4 py-3 whitespace-nowrap">{cell(row.total)}</td>
            </tr>
          ))}
          <tr className="bg-bg/40">
            <td className="px-4 py-3 text-xs text-muted">Total :</td>
            {dayTotals.map((s, i) => (
              <td key={i} className="text-right px-3 py-3 whitespace-nowrap">
                {cell(s)}
              </td>
            ))}
            <td className="text-right px-4 py-3 whitespace-nowrap">{cell(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
