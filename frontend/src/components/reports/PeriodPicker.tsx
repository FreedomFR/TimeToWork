import { useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import {
  PeriodUnit,
  formatDateRangeLabel,
  formatPeriodLabel,
  periodRange,
  shiftPeriod,
  toDateStr,
} from "../../utils/time";
import { IconCalendar, IconChevronDown, IconChevronLeft, IconChevronRight } from "../icons";

export interface CustomRange {
  from: Date;
  to: Date;
}

interface Props {
  unit: PeriodUnit;
  anchor: Date;
  customRange: CustomRange | null;
  onChangePreset: (unit: PeriodUnit, anchor: Date) => void;
  onChangeCustom: (range: CustomRange) => void;
  // Weekly report: always exactly one Monday–Sunday week, shown as a date range.
  weekOnly?: boolean;
}

const PRESETS: { label: string; unit: PeriodUnit; offset: number }[] = [
  { label: "Aujourd'hui", unit: "day", offset: 0 },
  { label: "Hier", unit: "day", offset: -1 },
  { label: "Cette semaine", unit: "week", offset: 0 },
  { label: "Semaine dernière", unit: "week", offset: -1 },
  { label: "Ce mois-ci", unit: "month", offset: 0 },
  { label: "Mois dernier", unit: "month", offset: -1 },
  { label: "Cette année", unit: "year", offset: 0 },
];

/**
 * Period dropdown (presets + custom range) with previous/next arrows.
 * Emits either a preset (`onChangePreset`) or an explicit range (`onChangeCustom`);
 * the parent owns the state. In `weekOnly` mode it always represents one week.
 */
export default function PeriodPicker({
  unit,
  anchor,
  customRange,
  onChangePreset,
  onChangeCustom,
  weekOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [fromDraft, setFromDraft] = useState(toDateStr(customRange?.from || anchor));
  const [toDraft, setToDraft] = useState(toDateStr(customRange?.to || anchor));
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => {
    setOpen(false);
    setShowCustom(false);
  });

  function openCustom() {
    setFromDraft(toDateStr(customRange?.from || anchor));
    setToDraft(toDateStr(customRange?.to || anchor));
    setShowCustom(true);
  }

  function applyCustom() {
    const from = new Date(`${fromDraft}T00:00:00`);
    const to = new Date(`${toDraft}T23:59:59.999`);
    if (from > to) return;
    onChangeCustom({ from, to });
    setOpen(false);
    setShowCustom(false);
  }

  const [weekStart, weekEnd] = periodRange("week", anchor);
  const label = weekOnly
    ? formatDateRangeLabel(weekStart, weekEnd)
    : customRange
      ? formatDateRangeLabel(customRange.from, customRange.to)
      : formatPeriodLabel(unit, anchor);
  const presets = weekOnly ? PRESETS.filter((p) => p.unit === "week") : PRESETS;

  return (
    <div className="flex items-center gap-1">
      <div className="relative" ref={ref}>
        <button
          type="button"
          title="Choisir une période"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded bg-surfaceAlt hover:bg-sidebarHover text-gray-200 whitespace-nowrap"
        >
          <IconCalendar className="w-4 h-4 text-muted" />
          {label}
          <IconChevronDown className="w-3.5 h-3.5 text-muted" />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 left-0 w-56 bg-surface border border-border rounded shadow-lg overflow-hidden">
            {!showCustom ? (
              <>
                {presets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      onChangePreset(p.unit, shiftPeriod(p.unit, new Date(), p.offset));
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-surfaceAlt"
                  >
                    {p.label}
                  </button>
                ))}
                {!weekOnly && (
                  <button
                    onClick={openCustom}
                    className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-surfaceAlt border-t border-border"
                  >
                    Plage personnalisée...
                  </button>
                )}
              </>
            ) : (
              <div className="p-3 space-y-2">
                <div>
                  <label className="block text-xs text-muted mb-1">Du</label>
                  <input
                    type="date"
                    value={fromDraft}
                    onChange={(e) => setFromDraft(e.target.value)}
                    className="w-full bg-surfaceAlt border-none rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Au</label>
                  <input
                    type="date"
                    value={toDraft}
                    onChange={(e) => setToDraft(e.target.value)}
                    className="w-full bg-surfaceAlt border-none rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                {fromDraft > toDraft && (
                  <p className="text-xs text-red-400">La date de début doit précéder la date de fin.</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={applyCustom}
                    disabled={fromDraft > toDraft}
                    className="flex-1 bg-accent hover:bg-accentDark text-white text-xs font-medium rounded py-1.5 disabled:opacity-50"
                  >
                    Appliquer
                  </button>
                  <button
                    onClick={() => setShowCustom(false)}
                    className="text-xs text-muted hover:text-gray-200 px-2"
                  >
                    Retour
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        title="Période précédente"
        disabled={!!customRange}
        onClick={() => onChangePreset(unit, shiftPeriod(unit, anchor, -1))}
        className="w-9 h-9 shrink-0 rounded flex items-center justify-center text-muted hover:text-gray-200 hover:bg-surfaceAlt disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <IconChevronLeft />
      </button>
      <button
        type="button"
        title="Période suivante"
        disabled={!!customRange}
        onClick={() => onChangePreset(unit, shiftPeriod(unit, anchor, 1))}
        className="w-9 h-9 shrink-0 rounded flex items-center justify-center text-muted hover:text-gray-200 hover:bg-surfaceAlt disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <IconChevronRight />
      </button>
    </div>
  );
}
