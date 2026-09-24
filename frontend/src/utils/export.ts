import { TimeEntry } from "../api/types";
import { dateStrOf, durationSeconds, formatClock, formatDuration, roundToQuarterHour } from "./time";
import { buildXlsx } from "./xlsx";

export type ExportFormat = "csv" | "xlsx" | "pdf" | "json";
export type ExportContent = "detailed" | "byProject" | "byDay";
export type Cell = string | number;

export interface Table {
  headers: string[];
  rows: Cell[][];
}

export const DETAIL_COLUMNS = [
  { key: "date", label: "Date" },
  { key: "start", label: "Début" },
  { key: "end", label: "Fin" },
  { key: "duration", label: "Durée" },
  { key: "hours", label: "Heures (décimal)" },
  { key: "project", label: "Projet" },
  { key: "client", label: "Client" },
  { key: "description", label: "Description" },
  { key: "tags", label: "Balises" },
  { key: "billable", label: "Facturable" },
  { key: "user", label: "Utilisateur" },
] as const;

export type DetailColumnKey = (typeof DETAIL_COLUMNS)[number]["key"];

export const DEFAULT_COLUMNS: DetailColumnKey[] = [
  "date",
  "start",
  "end",
  "duration",
  "project",
  "client",
  "description",
  "tags",
  "billable",
];

export const CONTENT_LABELS: Record<ExportContent, string> = {
  detailed: "Détaillé (une ligne par entrée)",
  byProject: "Résumé par projet",
  byDay: "Résumé par jour",
};

const CONTENT_SLUGS: Record<ExportContent, string> = {
  detailed: "detaille",
  byProject: "par-projet",
  byDay: "par-jour",
};

export const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  csv: "csv",
  xlsx: "xlsx",
  pdf: "pdf",
  json: "json",
};

export interface BuildOptions {
  columns: DetailColumnKey[];
  rounded: boolean;
  userName: string;
}

const decimalHours = (seconds: number) => Math.round((seconds / 3600) * 100) / 100;

export function buildTable(content: ExportContent, entries: TimeEntry[], opts: BuildOptions): Table {
  const secondsOf = (e: TimeEntry) => {
    const s = durationSeconds(e.start, e.end);
    return opts.rounded ? roundToQuarterHour(s) : s;
  };

  if (content === "detailed") {
    const columns = DETAIL_COLUMNS.filter((c) => opts.columns.includes(c.key));
    const sorted = [...entries].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const value = (e: TimeEntry, key: DetailColumnKey): Cell => {
      switch (key) {
        case "date":
          return dateStrOf(e.start);
        case "start":
          return formatClock(e.start);
        case "end":
          return e.end ? formatClock(e.end) : "";
        case "duration":
          return formatDuration(secondsOf(e));
        case "hours":
          return decimalHours(secondsOf(e));
        case "project":
          return e.project?.name || "";
        case "client":
          return e.project?.client?.name || "";
        case "description":
          return e.description;
        case "tags":
          return e.tags.map((t) => t.name).join(", ");
        case "billable":
          return e.billable ? "Oui" : "Non";
        case "user":
          return opts.userName;
      }
    };
    return {
      headers: columns.map((c) => c.label),
      rows: sorted.map((e) => columns.map((c) => value(e, c.key))),
    };
  }

  if (content === "byProject") {
    const groups = new Map<string, { project: string; client: string; count: number; seconds: number }>();
    for (const e of entries) {
      const key = e.projectId || "none";
      const g = groups.get(key) || {
        project: e.project?.name || "Aucun projet",
        client: e.project?.client?.name || "",
        count: 0,
        seconds: 0,
      };
      g.count += 1;
      g.seconds += secondsOf(e);
      groups.set(key, g);
    }
    const list = Array.from(groups.values()).sort((a, b) => b.seconds - a.seconds);
    const totalCount = list.reduce((s, g) => s + g.count, 0);
    const totalSeconds = list.reduce((s, g) => s + g.seconds, 0);
    return {
      headers: ["Projet", "Client", "Entrées", "Durée", "Heures (décimal)"],
      rows: [
        ...list.map((g): Cell[] => [g.project, g.client, g.count, formatDuration(g.seconds), decimalHours(g.seconds)]),
        ["Total", "", totalCount, formatDuration(totalSeconds), decimalHours(totalSeconds)],
      ],
    };
  }

  const days = new Map<string, { count: number; seconds: number }>();
  for (const e of entries) {
    const key = dateStrOf(e.start);
    const d = days.get(key) || { count: 0, seconds: 0 };
    d.count += 1;
    d.seconds += secondsOf(e);
    days.set(key, d);
  }
  const list = Array.from(days.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const totalCount = list.reduce((s, [, d]) => s + d.count, 0);
  const totalSeconds = list.reduce((s, [, d]) => s + d.seconds, 0);
  return {
    headers: ["Date", "Entrées", "Durée", "Heures (décimal)"],
    rows: [
      ...list.map(([date, d]): Cell[] => [date, d.count, formatDuration(d.seconds), decimalHours(d.seconds)]),
      ["Total", totalCount, formatDuration(totalSeconds), decimalHours(totalSeconds)],
    ],
  };
}

export function toCsv(table: Table): string {
  const quote = (cell: Cell) => `"${String(cell).replace(/"/g, '""')}"`;
  const lines = [table.headers, ...table.rows].map((r) => r.map(quote).join(","));
  return "﻿" + lines.join("\n");
}

export function toJson(table: Table): string {
  const objects = table.rows.map((row) =>
    Object.fromEntries(table.headers.map((h, i) => [h, row[i]]))
  );
  return JSON.stringify(objects, null, 2);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// No PDF library: render a print-friendly document in a hidden frame and open the
// browser's print dialog, from which "Save as PDF" produces the file.
export function printAsPdf(table: Table, title: string, subtitle: string) {
  const head = table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = table.rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(String(c))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  p { font-size: 12px; color: #555; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
</style></head><body>
<h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);

  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  const win = frame.contentWindow!;
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", cleanup);
  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportFilename(content: ExportContent, format: ExportFormat, from: Date, to: Date): string {
  return `rapport-${CONTENT_SLUGS[content]}_${dateStrOf(from.toISOString())}_${dateStrOf(to.toISOString())}.${FORMAT_EXTENSIONS[format]}`;
}

export function exportTable(
  table: Table,
  format: ExportFormat,
  filename: string,
  meta: { title: string; subtitle: string }
) {
  switch (format) {
    case "csv":
      downloadBlob(new Blob([toCsv(table)], { type: "text/csv;charset=utf-8;" }), filename);
      break;
    case "json":
      downloadBlob(new Blob([toJson(table)], { type: "application/json;charset=utf-8;" }), filename);
      break;
    case "xlsx": {
      const bytes = buildXlsx(table.headers, table.rows);
      downloadBlob(
        new Blob([bytes.buffer as ArrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        filename
      );
      break;
    }
    case "pdf":
      printAsPdf(table, meta.title, meta.subtitle);
      break;
  }
}
