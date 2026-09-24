/**
 * Pure layout logic of the calendar view: where each entry sits in its day
 * column, and how overlapping entries share the width.
 */
import { TimeEntry } from "../api/types";
import { dateStrOf, durationSeconds, toDateStr } from "./time";

export const MINUTES_PER_DAY = 24 * 60;

/** Entries shorter than this are laid out as if they lasted this long, so they stay clickable and don't hide neighbours. */
const MIN_VISUAL_MINUTES = 15;

/** An entry positioned inside one day column. Times are minutes since local midnight. */
export interface CalendarEvent {
  entry: TimeEntry;
  startMin: number;
  /** Real end, clipped at midnight for entries running past the end of their start day. */
  endMin: number;
  /** Index of the sub-column the event sits in when it overlaps others (0-based). */
  column: number;
  /** Number of sub-columns of its overlap cluster: the event is `1 / columns` wide. */
  columns: number;
}

/** One day of the calendar with its events and total. */
export interface CalendarDay {
  /** `YYYY-MM-DD` */
  key: string;
  date: Date;
  events: CalendarEvent[];
  totalSeconds: number;
}

function minutesSinceMidnight(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

/**
 * Lays out the entries of one day. Entries that overlap in time are grouped in a
 * "cluster" and placed side by side: each one takes the first free sub-column, and
 * every event of a cluster gets the cluster's column count so widths line up.
 */
export function layoutDayEvents(entries: TimeEntry[]): CalendarEvent[] {
  const events: CalendarEvent[] = entries
    .map((entry) => {
      const startMin = minutesSinceMidnight(entry.start);
      const endMin = Math.min(MINUTES_PER_DAY, startMin + durationSeconds(entry.start, entry.end) / 60);
      return { entry, startMin, endMin, column: 0, columns: 1 };
    })
    // Earliest first; for equal starts the longest first, so it takes the left-most column
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  const visualEnd = (e: CalendarEvent) => Math.max(e.endMin, e.startMin + MIN_VISUAL_MINUTES);

  let cluster: CalendarEvent[] = [];
  let columnEnds: number[] = []; // visual end of the last event of each sub-column
  let clusterEnd = -1;

  const closeCluster = () => {
    for (const e of cluster) e.columns = columnEnds.length;
    cluster = [];
    columnEnds = [];
  };

  for (const event of events) {
    if (event.startMin >= clusterEnd) closeCluster();

    let column = columnEnds.findIndex((end) => end <= event.startMin);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = visualEnd(event);
    event.column = column;

    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, visualEnd(event));
  }
  closeCluster();

  return events;
}

/**
 * Builds the calendar columns for the given days: each entry goes to the day it
 * starts on (an entry running past midnight is clipped at 24:00 of that day).
 */
export function buildCalendarDays(entries: TimeEntry[], dates: Date[]): CalendarDay[] {
  const byDay = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = dateStrOf(entry.start);
    const list = byDay.get(key);
    if (list) list.push(entry);
    else byDay.set(key, [entry]);
  }

  return dates.map((date) => {
    const key = toDateStr(date);
    const dayEntries = byDay.get(key) ?? [];
    return {
      key,
      date,
      events: layoutDayEvents(dayEntries),
      totalSeconds: dayEntries.reduce((sum, e) => sum + durationSeconds(e.start, e.end), 0),
    };
  });
}

/** The `count` consecutive days starting at `first`. */
export function daysFrom(first: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(first);
    d.setDate(d.getDate() + i);
    return d;
  });
}
