import { formatDuration } from "../../utils/time";
import { CARD_CLASS } from "../ui/styles";
import ToggleSwitch from "../ui/ToggleSwitch";
import { WEEKLY_GROUP_LABELS, WeeklyGroupBy } from "./WeeklyTable";
import { IconPrint, IconShare } from "../icons";

interface Props {
  totalSeconds: number;
  rounded: boolean;
  onRoundedChange: (rounded: boolean) => void;
  /** Weekly tab only: the "Regrouper par" selector. */
  weeklyGroupBy?: { value: WeeklyGroupBy; onChange: (value: WeeklyGroupBy) => void };
}

/** Bar under the filters: total time, print, and the "Arrondi" (quarter-hour rounding) toggle. */
export default function TotalBar({ totalSeconds, rounded, onRoundedChange, weeklyGroupBy }: Props) {
  return (
    <div className={`${CARD_CLASS} px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-3`}>
      <span className="text-sm text-muted">
        Total : <span className="font-mono text-2xl text-gray-100 ml-2">{formatDuration(totalSeconds)}</span>
      </span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted/50 cursor-not-allowed" title="Non disponible">
          Créer une facture
        </span>
        <button onClick={() => window.print()} title="Imprimer" className="text-muted hover:text-gray-200">
          <IconPrint />
        </button>
        <button title="Non disponible" className="text-muted/50 cursor-not-allowed">
          <IconShare />
        </button>
        <ToggleSwitch checked={rounded} onChange={onRoundedChange} label="Arrondi" />
        {weeklyGroupBy && (
          <label className="flex items-center gap-2 text-sm text-muted">
            Regrouper par :
            <select
              aria-label="Regrouper par"
              value={weeklyGroupBy.value}
              onChange={(e) => weeklyGroupBy.onChange(e.target.value as WeeklyGroupBy)}
              className="bg-surfaceAlt border-none rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {(Object.keys(WEEKLY_GROUP_LABELS) as WeeklyGroupBy[]).map((g) => (
                <option key={g} value={g}>
                  {WEEKLY_GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
