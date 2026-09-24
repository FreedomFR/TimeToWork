import { useEffect, useState } from "react";
import { TimeEntry } from "../../api/types";
import {
  CONTENT_LABELS,
  DEFAULT_COLUMNS,
  DETAIL_COLUMNS,
  DetailColumnKey,
  ExportContent,
  ExportFormat,
  buildTable,
  exportFilename,
  exportTable,
} from "../../utils/export";
import { IconDownload } from "../icons";

interface Props {
  open: boolean;
  onClose: () => void;
  entries: TimeEntry[];
  rounded: boolean;
  userName: string;
  periodLabel: string;
  from: Date;
  to: Date;
}

const FORMATS: { value: ExportFormat; label: string; hint: string }[] = [
  { value: "csv", label: "CSV", hint: "Fichier texte, compatible tableurs et outils tiers" },
  { value: "xlsx", label: "Excel (.xlsx)", hint: "Classeur Excel avec en-têtes en gras" },
  { value: "pdf", label: "PDF", hint: "Ouvre l'impression : choisissez « Enregistrer au format PDF »" },
  { value: "json", label: "JSON", hint: "Données structurées pour les développeurs" },
];

/**
 * Export modal: choose the content (detailed / by project / by day), the columns for the
 * detailed content, and the file format. Closes on Escape.
 */
export default function ExportDialog({
  open,
  onClose,
  entries,
  rounded,
  userName,
  periodLabel,
  from,
  to,
}: Props) {
  const [content, setContent] = useState<ExportContent>("detailed");
  const [columns, setColumns] = useState<DetailColumnKey[]>(DEFAULT_COLUMNS);
  const [format, setFormat] = useState<ExportFormat>("csv");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const detailed = content === "detailed";
  const canExport = entries.length > 0 && (!detailed || columns.length > 0);

  function toggleColumn(key: DetailColumnKey) {
    setColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function handleExport() {
    const table = buildTable(content, entries, { columns, rounded, userName });
    exportTable(table, format, exportFilename(content, format, from, to), {
      title: `Rapport de temps — ${CONTENT_LABELS[content]}`,
      subtitle: `${periodLabel}${rounded ? " · durées arrondies au quart d'heure" : ""}`,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Exporter le rapport"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-lg shadow-xl"
      >
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-gray-100">Exporter le rapport</h2>
          <p className="text-xs text-muted mt-1">
            {periodLabel} · {entries.length} entrée(s) après filtres
          </p>
        </div>

        <div className="px-5 py-4 space-y-5">
          <fieldset>
            <legend className="text-xs text-muted mb-2">CONTENU À EXPORTER</legend>
            <div className="space-y-1.5">
              {(Object.keys(CONTENT_LABELS) as ExportContent[]).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                  <input
                    type="radio"
                    name="export-content"
                    checked={content === c}
                    onChange={() => setContent(c)}
                    className="accent-accent"
                  />
                  {CONTENT_LABELS[c]}
                </label>
              ))}
            </div>
          </fieldset>

          {detailed && (
            <fieldset>
              <legend className="flex items-center justify-between w-full text-xs text-muted mb-2">
                <span>COLONNES</span>
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setColumns(DETAIL_COLUMNS.map((c) => c.key))}
                    className="text-accent hover:underline"
                  >
                    Tout
                  </button>
                  <button
                    type="button"
                    onClick={() => setColumns([])}
                    className="text-accent hover:underline"
                  >
                    Aucune
                  </button>
                </span>
              </legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {DETAIL_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={columns.includes(c.key)}
                      onChange={() => toggleColumn(c.key)}
                      className="accent-accent"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              {columns.length === 0 && (
                <p className="text-xs text-red-400 mt-2">Sélectionnez au moins une colonne.</p>
              )}
            </fieldset>
          )}

          <fieldset>
            <legend className="text-xs text-muted mb-2">FORMAT</legend>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <label
                  key={f.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded border text-sm cursor-pointer ${
                    format === f.value
                      ? "border-accent bg-accent/10 text-gray-100"
                      : "border-border text-gray-300 hover:bg-surfaceAlt"
                  }`}
                >
                  <input
                    type="radio"
                    name="export-format"
                    checked={format === f.value}
                    onChange={() => setFormat(f.value)}
                    className="accent-accent"
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">{FORMATS.find((f) => f.value === format)?.hint}</p>
          </fieldset>

          {entries.length === 0 && (
            <p className="text-xs text-muted">Aucune donnée à exporter pour cette période et ces filtres.</p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded text-gray-300 hover:bg-surfaceAlt"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={!canExport}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded bg-accent hover:bg-accentDark text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconDownload className="w-4 h-4" />
            Exporter
          </button>
        </div>
      </div>
    </div>
  );
}
