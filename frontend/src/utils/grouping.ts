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

/** Largest pause (ms) still considered "no pause" between two entries of the same mission. */
const MAX_MERGE_GAP_MS = 60_000;

/**
 * True when `later` starts right when `earlier` ends (a pause of at most a minute, or an
 * overlap), i.e. the two look like one continuous piece of work that was split in two.
 */
export function areContiguous(earlier: TimeEntry, later: TimeEntry): boolean {
  if (!earlier.end) return false;
  return new Date(later.start).getTime() - new Date(earlier.end).getTime() <= MAX_MERGE_GAP_MS;
}

/**
 * Finds the runs of consecutive entries (given in chronological order) that follow each other
 * without a pause. Only runs of two or more are returned; each is a candidate for merging.
 */
export function contiguousRuns(chronological: TimeEntry[]): TimeEntry[][] {
  const runs: TimeEntry[][] = [];
  let run: TimeEntry[] = [];
  let runEnd = 0; // latest end within the current run, so a nested entry can't break the chain

  for (const entry of chronological) {
    const startsRight = run.length > 0 && new Date(entry.start).getTime() - runEnd <= MAX_MERGE_GAP_MS;
    if (!startsRight) {
      if (run.length >= 2) runs.push(run);
      run = [];
      runEnd = 0;
    }
    run.push(entry);
    runEnd = Math.max(runEnd, entry.end ? new Date(entry.end).getTime() : Infinity);
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}
