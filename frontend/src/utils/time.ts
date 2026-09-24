/**
 * Date and duration helpers shared across the app.
 *
 * Conventions:
 *  - "ISO string": what the API sends/receives (UTC instant).
 *  - "date string": local calendar day as `YYYY-MM-DD`.
 *  - "time string": local clock time as `HH:mm`.
 * All calendar logic (day/week/month boundaries) uses the browser's local time zone.
 */

const pad = (n: number) => String(n).padStart(2, "0");

// ---- Durations ----

/** Rounds a duration to the nearest quarter of an hour (the reports' "Arrondi" toggle). */
export function roundToQuarterHour(totalSeconds: number): number {
  return Math.round(totalSeconds / 900) * 900;
}

/** `3725` → `"01:02:05"`. */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map(pad).join(":");
}

/** Seconds between two ISO strings; a missing `end` means "still running" (until now). */
export function durationSeconds(start: string, end: string | null): number {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

// ---- Formatting ----

/** 24h `HH:mm` clock time of an ISO string, in French locale. */
export function formatClock(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** True when both dates fall on the same local calendar day. */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Aujourd'hui", "Hier", or a short label like "lun., sept. 21" (used as time-tracker day headers). */
export function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(date, today)) return "Aujourd'hui";
  if (sameDay(date, yesterday)) return "Hier";

  const weekday = date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
  const month = date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  return `${weekday}., ${month}. ${date.getDate()}`;
}

/** Stable key identifying the local calendar day of an ISO string (for grouping). */
export function dayKey(dateStr: string): string {
  return new Date(dateStr).toDateString();
}

/** Monday-based start of the week, at 00:00 local time. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay() || 7; // Sunday -> 7
  d.setDate(d.getDate() - day + 1);
  return d;
}

/** Stable key identifying the Monday-based week of an ISO string (for grouping). */
export function weekKey(dateStr: string): string {
  return startOfWeek(new Date(dateStr)).toDateString();
}

/** "Cette semaine", "Semaine dernière", or a range like "21 sept - 27 sept". */
export function formatWeekLabel(weekStartKey: string): string {
  const weekStart = new Date(weekStartKey);
  const thisWeekStart = startOfWeek(new Date());
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  if (sameDay(weekStart, thisWeekStart)) return "Cette semaine";
  if (sameDay(weekStart, lastWeekStart)) return "Semaine dernière";

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "");
  return `${fmt(weekStart)} - ${fmt(weekEnd)}`;
}

/** Parses a typed duration: "1:30:00", "1:30" or "90" (minutes) → seconds, or null if unparsable. */
export function parseDurationInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length >= 2 && parts.every((p) => /^\d+$/.test(p))) {
    const nums = parts.map(Number);
    if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
    if (nums.length === 2) return nums[0] * 3600 + nums[1] * 60;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 60;
  }

  return null;
}

/** Free-form clock time → "HH:mm". Accepts "0800", "800", "8", "8:00", "8h30", "20:15"…, or null. */
export function parseTimeInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace("h", ":");
  if (!trimmed) return null;

  let hours: number;
  let minutes: number;

  if (trimmed.includes(":")) {
    const [h, m] = trimmed.split(":");
    if (!/^\d{1,2}$/.test(h) || !/^\d{0,2}$/.test(m)) return null;
    hours = Number(h);
    minutes = m ? Number(m) : 0;
  } else if (/^\d{1,2}$/.test(trimmed)) {
    hours = Number(trimmed);
    minutes = 0;
  } else if (/^\d{3,4}$/.test(trimmed)) {
    minutes = Number(trimmed.slice(-2));
    hours = Number(trimmed.slice(0, -2));
  } else {
    return null;
  }

  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// ---- Splitting / combining date and time ----

/** Local `YYYY-MM-DD` of a Date. */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local `HH:mm` of a Date. */
export function toTimeStr(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local `YYYY-MM-DD` of an ISO string. */
export function dateStrOf(dateStr: string): string {
  return toDateStr(new Date(dateStr));
}

/** Local `HH:mm` of an ISO string. */
export function timeStrOf(dateStr: string): string {
  return toTimeStr(new Date(dateStr));
}

/** Today's local date string. */
export function todayStr(): string {
  return toDateStr(new Date());
}

/** Current local time string. */
export function nowTimeStr(): string {
  return toTimeStr(new Date());
}

/** Local date string + time string → ISO string (UTC instant). */
export function combineDateTime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

// ---- Report period helpers ----

export type PeriodUnit = "day" | "week" | "month" | "year";

/** Local midnight at the start of the day. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Last millisecond of the local day. */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Last millisecond of the Sunday ending the Monday-based week. */
export function endOfWeek(date: Date): Date {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

/** First instant of the month. */
export function startOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Last millisecond of the month. */
export function endOfMonth(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return endOfDay(d);
}

/** First instant of the year. */
export function startOfYear(date: Date): Date {
  const d = new Date(date.getFullYear(), 0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Last millisecond of the year. */
export function endOfYear(date: Date): Date {
  const d = new Date(date.getFullYear(), 11, 31);
  return endOfDay(d);
}

/** Inclusive [start, end] of the day/week/month/year containing `anchor`. */
export function periodRange(unit: PeriodUnit, anchor: Date): [Date, Date] {
  switch (unit) {
    case "day":
      return [startOfDay(anchor), endOfDay(anchor)];
    case "week":
      return [startOfWeek(anchor), endOfWeek(anchor)];
    case "month":
      return [startOfMonth(anchor), endOfMonth(anchor)];
    case "year":
      return [startOfYear(anchor), endOfYear(anchor)];
  }
}

/** Moves `anchor` by `delta` periods (negative = backwards). */
export function shiftPeriod(unit: PeriodUnit, anchor: Date, delta: number): Date {
  const d = new Date(anchor);
  if (unit === "day") d.setDate(d.getDate() + delta);
  else if (unit === "week") d.setDate(d.getDate() + delta * 7);
  else if (unit === "month") d.setMonth(d.getMonth() + delta);
  else d.setFullYear(d.getFullYear() + delta);
  return d;
}

/** Label for a period picker: "Cette semaine", "Mois dernier", or an explicit date. */
export function formatPeriodLabel(unit: PeriodUnit, anchor: Date): string {
  const now = new Date();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (unit === "day") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDay(anchor, now)) return "Aujourd'hui";
    if (sameDay(anchor, yesterday)) return "Hier";
    return cap(
      anchor.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    );
  }

  if (unit === "week") {
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = shiftPeriod("week", thisWeekStart, -1);
    const anchorWeekStart = startOfWeek(anchor);
    if (sameDay(anchorWeekStart, thisWeekStart)) return "Cette semaine";
    if (sameDay(anchorWeekStart, lastWeekStart)) return "Semaine dernière";
    const [start, end] = periodRange("week", anchor);
    const fmt = (d: Date) =>
      d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }).replace(".", "");
    return `${fmt(start)} - ${fmt(end)}`;
  }

  if (unit === "month") {
    if (anchor.getFullYear() === now.getFullYear() && anchor.getMonth() === now.getMonth())
      return "Ce mois-ci";
    const lastMonth = shiftPeriod("month", now, -1);
    if (anchor.getFullYear() === lastMonth.getFullYear() && anchor.getMonth() === lastMonth.getMonth())
      return "Mois dernier";
    return cap(anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }));
  }

  // year
  if (anchor.getFullYear() === now.getFullYear()) return "Cette année";
  if (anchor.getFullYear() === now.getFullYear() - 1) return "Année dernière";
  return String(anchor.getFullYear());
}

/** "21 sept - 27 sept 2026" style label for an explicit date range. */
export function formatDateRangeLabel(from: Date, to: Date): string {
  const sameYear = from.getFullYear() === to.getFullYear();
  const fmt = (d: Date, withYear: boolean) =>
    d
      .toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: withYear ? "numeric" : undefined,
      })
      .replace(".", "");
  return `${fmt(from, !sameYear)} - ${fmt(to, true)}`;
}

/** Fixed-format day label for chart axes, independent of "Aujourd'hui"/"Hier". */
export function formatChartDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const weekday = date.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
  const month = date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
  return `${weekday}. ${date.getDate()} ${month}.`;
}
