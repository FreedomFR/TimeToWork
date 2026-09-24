/**
 * Pure computation behind the dashboard page: totals, top project/client,
 * chart buckets, per-project shares and most-tracked activities.
 */
import { TimeEntry } from "../api/types";
import { NEUTRAL_COLOR, NO_DESCRIPTION_LABEL, NO_PROJECT_LABEL } from "./constants";
import { dateStrOf, durationSeconds } from "./time";

export interface Bucket {
  key: string;
  label: string;
  totalSeconds: number;
  segments: { color: string; seconds: number }[];
}

export interface ProjectShare {
  key: string;
  name: string;
  clientName: string | null;
  color: string;
  seconds: number;
  percent: number;
}

export interface Activity {
  key: string;
  description: string;
  projectName: string | null;
  clientName: string | null;
  color: string;
  seconds: number;
}

export interface DashboardStats {
  totalSeconds: number;
  topProject: string | null;
  topClient: string | null;
  buckets: Bucket[];
  shares: ProjectShare[];
  activities: Activity[];
}

// Above this many days the bar chart switches from one bar per day to one per month.
export const MAX_DAILY_BARS = 62;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dayLabel(d: Date): string {
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" });
  const month = d.toLocaleDateString("fr-FR", { month: "short" });
  return `${weekday}, ${month} ${d.getDate()}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
}

/**
 * One bucket per day of the range (empty days included, so the chart shows every
 * day), or one per month when the range exceeds `MAX_DAILY_BARS` days.
 */
function buildBuckets(entries: TimeEntry[], from: Date, to: Date): Bucket[] {
  const dayCount = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const monthly = dayCount > MAX_DAILY_BARS;
  const buckets = new Map<string, { bucket: Bucket; perProject: Map<string, { color: string; seconds: number }> }>();

  const cursor = new Date(from.getFullYear(), from.getMonth(), monthly ? 1 : from.getDate());
  while (cursor <= to) {
    const key = monthly
      ? `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`
      : `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    buckets.set(key, {
      bucket: { key, label: monthly ? monthLabel(cursor) : dayLabel(cursor), totalSeconds: 0, segments: [] },
      perProject: new Map(),
    });
    if (monthly) cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }

  for (const e of entries) {
    const day = dateStrOf(e.start);
    const target = buckets.get(monthly ? day.slice(0, 7) : day);
    if (!target) continue;
    const projKey = e.projectId || "none";
    const current = target.perProject.get(projKey) || { color: e.project?.color || NEUTRAL_COLOR, seconds: 0 };
    current.seconds += durationSeconds(e.start, e.end);
    target.perProject.set(projKey, current);
  }

  return Array.from(buckets.values()).map(({ bucket, perProject }) => {
    const segments = Array.from(perProject.values()).sort((a, b) => b.seconds - a.seconds);
    return { ...bucket, segments, totalSeconds: segments.reduce((s, x) => s + x.seconds, 0) };
  });
}

/** Key with the largest total, or null when every total is 0. */
function topKey(totals: Map<string, number>): string | null {
  let best: string | null = null;
  let bestSeconds = 0;
  for (const [name, seconds] of totals) {
    if (seconds > bestSeconds) {
      best = name;
      bestSeconds = seconds;
    }
  }
  return best;
}

/** Computes every figure shown on the dashboard for the entries within [from, to]. */
export function computeDashboard(entries: TimeEntry[], from: Date, to: Date): DashboardStats {
  const projectTotals = new Map<string, number>();
  const clientTotals = new Map<string, number>();
  const shareMap = new Map<string, ProjectShare>();
  const activityMap = new Map<string, Activity>();
  let totalSeconds = 0;

  for (const e of entries) {
    const seconds = durationSeconds(e.start, e.end);
    totalSeconds += seconds;

    const projectName = e.project?.name ?? null;
    const clientName = e.project?.client?.name ?? null;
    const color = e.project?.color || NEUTRAL_COLOR;

    if (projectName) projectTotals.set(projectName, (projectTotals.get(projectName) || 0) + seconds);
    if (clientName) clientTotals.set(clientName, (clientTotals.get(clientName) || 0) + seconds);

    const shareKey = e.projectId || "none";
    const share = shareMap.get(shareKey) || {
      key: shareKey,
      name: projectName ?? NO_PROJECT_LABEL,
      clientName,
      color,
      seconds: 0,
      percent: 0,
    };
    share.seconds += seconds;
    shareMap.set(shareKey, share);

    const description = e.description || NO_DESCRIPTION_LABEL;
    const activityKey = `${description}\u0000${e.projectId || "none"}`;
    const activity = activityMap.get(activityKey) || {
      key: activityKey,
      description,
      projectName,
      clientName,
      color,
      seconds: 0,
    };
    activity.seconds += seconds;
    activityMap.set(activityKey, activity);
  }

  const shares = Array.from(shareMap.values())
    .filter((s) => s.seconds > 0)
    .map((s) => ({ ...s, percent: totalSeconds > 0 ? (s.seconds / totalSeconds) * 100 : 0 }))
    .sort((a, b) => b.seconds - a.seconds);

  const activities = Array.from(activityMap.values()).sort((a, b) => b.seconds - a.seconds);

  return {
    totalSeconds,
    topProject: topKey(projectTotals),
    topClient: topKey(clientTotals),
    buckets: buildBuckets(entries, from, to),
    shares,
    activities,
  };
}
