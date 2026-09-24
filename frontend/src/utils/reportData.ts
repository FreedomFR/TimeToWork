/**
 * Pure data helpers behind the report tabs (filtering, per-day totals, grouping).
 * Kept free of React so they are easy to reason about and reuse.
 */
import { TimeEntry } from "../api/types";
import { NEUTRAL_COLOR, NO_DESCRIPTION_LABEL, NO_PROJECT_LABEL } from "./constants";
import { dateStrOf, durationSeconds, roundToQuarterHour } from "./time";

/** Duration of an entry in seconds, optionally rounded to the nearest quarter hour. */
export function entrySeconds(entry: TimeEntry, rounded: boolean): number {
  const seconds = durationSeconds(entry.start, entry.end);
  return rounded ? roundToQuarterHour(seconds) : seconds;
}

// ─── Filtering ─────────────────────────────────────────────────────────────

export interface EntryFilters {
  projectIds: string[];
  clientIds: string[];
  tagIds: string[];
  /** Case-insensitive "contains" match on the description. */
  description: string;
}

/**
 * Applies the report filters. Running entries (no end yet) are always excluded;
 * an empty filter list means "no restriction" for that criterion.
 */
export function filterEntries(entries: TimeEntry[], filters: EntryFilters): TimeEntry[] {
  const query = filters.description.trim().toLowerCase();
  return entries.filter((e) => {
    if (e.end === null) return false;
    if (filters.projectIds.length > 0 && !(e.projectId && filters.projectIds.includes(e.projectId))) return false;
    if (filters.clientIds.length > 0 && !(e.project?.clientId && filters.clientIds.includes(e.project.clientId)))
      return false;
    if (filters.tagIds.length > 0 && !e.tags.some((t) => filters.tagIds.includes(t.id))) return false;
    if (query && !e.description.toLowerCase().includes(query)) return false;
    return true;
  });
}

// ─── Per-day bars ──────────────────────────────────────────────────────────

/** One bar of the summary chart: a day, stacked by project color. */
export interface DayBar {
  /** `YYYY-MM-DD` */
  date: string;
  totalSeconds: number;
  segments: { color: string; seconds: number }[];
}

/** Total time per day (only days with entries), split by project, sorted chronologically. */
export function buildDayBars(entries: TimeEntry[], rounded: boolean): DayBar[] {
  const byDay = new Map<string, Map<string, { color: string; seconds: number }>>();

  for (const e of entries) {
    const day = dateStrOf(e.start);
    if (!byDay.has(day)) byDay.set(day, new Map());
    const perProject = byDay.get(day)!;

    const projectKey = e.projectId || "none";
    const segment = perProject.get(projectKey) || { color: e.project?.color || NEUTRAL_COLOR, seconds: 0 };
    segment.seconds += entrySeconds(e, rounded);
    perProject.set(projectKey, segment);
  }

  return Array.from(byDay.entries())
    .map(([date, perProject]) => {
      const segments = Array.from(perProject.values());
      return { date, segments, totalSeconds: segments.reduce((s, x) => s + x.seconds, 0) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Grouped table ─────────────────────────────────────────────────────────

export type GroupBy = "project" | "description";

/** One row of the summary table: all entries sharing a project (or description). */
export interface GroupRow {
  key: string;
  name: string;
  clientName: string | null;
  color: string;
  seconds: number;
  count: number;
  entries: TimeEntry[];
}

/** Groups entries by project or description, sorted by total duration. */
export function groupEntries(
  entries: TimeEntry[],
  groupBy: GroupBy,
  rounded: boolean,
  sortDesc: boolean
): GroupRow[] {
  const groups = new Map<string, GroupRow>();

  for (const e of entries) {
    const description = e.description || NO_DESCRIPTION_LABEL;
    const key = groupBy === "project" ? e.projectId || "none" : description;
    const seconds = entrySeconds(e, rounded);

    const group = groups.get(key);
    if (group) {
      group.seconds += seconds;
      group.count += 1;
      group.entries.push(e);
    } else {
      groups.set(key, {
        key,
        name: groupBy === "project" ? e.project?.name || NO_PROJECT_LABEL : description,
        clientName: e.project?.client?.name || null,
        color: e.project?.color || NEUTRAL_COLOR,
        seconds,
        count: 1,
        entries: [e],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => (sortDesc ? b.seconds - a.seconds : a.seconds - b.seconds));
}
