import { TimeEntry } from "../api/types";
import { dayKey, durationSeconds, weekKey } from "./time";

/** All entries of one calendar day. */
export interface DayGroup {
  key: string;
  entries: TimeEntry[];
  totalSeconds: number;
}

/** All days of one Monday-based week, most recent first. */
export interface WeekGroup {
  key: string;
  days: DayGroup[];
  totalSeconds: number;
}

const startMs = (entry: TimeEntry) => new Date(entry.start).getTime();

function totalOf(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => sum + durationSeconds(e.start, e.end), 0);
}

/** Groups `items` by the string returned by `keyOf`, preserving first-seen order. */
function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/**
 * Organizes entries for the time-tracker list: weeks (most recent first) → days
 * (most recent first) → entries, with totals at each level.
 */
export function groupByWeekAndDay(entries: TimeEntry[]): WeekGroup[] {
  const days: DayGroup[] = Array.from(groupBy(entries, (e) => dayKey(e.start)).entries())
    .map(([key, dayEntries]) => ({ key, entries: dayEntries, totalSeconds: totalOf(dayEntries) }))
    .sort((a, b) => startMs(b.entries[0]) - startMs(a.entries[0]));

  return Array.from(groupBy(days, (day) => weekKey(day.entries[0].start)).entries())
    .map(([key, weekDays]) => ({
      key,
      days: weekDays,
      totalSeconds: weekDays.reduce((sum, d) => sum + d.totalSeconds, 0),
    }))
    .sort((a, b) => new Date(b.key).getTime() - new Date(a.key).getTime());
}

/** Identity of an entry for grouping: same description, project, billable flag and set of tags. */
function identityKey(entry: TimeEntry): string {
  const tagKey = entry.tags.map((t) => t.id).sort().join(",");
  return [entry.description, entry.projectId || "", entry.billable, tagKey].join("|");
}

/**
 * Splits one day's entries into groups of identical entries (see `identityKey`),
 * most recent group first. Each group keeps its entries in the given order.
 */
export function groupIdenticalEntries(dayEntries: TimeEntry[]): TimeEntry[][] {
  return Array.from(groupBy(dayEntries, identityKey).values()).sort((a, b) => startMs(b[0]) - startMs(a[0]));
}
