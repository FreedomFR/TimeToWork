import { DayBar } from "../../utils/reportData";
import { formatChartDayLabel } from "../../utils/time";

interface Props {
  days: DayBar[];
}

const CHART_HEIGHT = 220;

/** Stacked bar chart of the time per day (summary report), with an hours axis. */
export default function BarChart({ days }: Props) {
  const maxSeconds = Math.max(1, ...days.map((d) => d.totalSeconds));
  const maxHours = Math.max(1, Math.ceil(maxSeconds / 3600));
  const gridStep = maxHours <= 6 ? 1 : Math.ceil(maxHours / 6);
  const gridLines = [];
  for (let h = 0; h <= maxHours; h += gridStep) gridLines.push(h);

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted text-sm" style={{ height: CHART_HEIGHT }}>
        Aucune donnée pour cette période
      </div>
    );
  }

  return (
    <div className="flex">
      <div className="flex flex-col justify-between text-xs text-muted pr-2 shrink-0" style={{ height: CHART_HEIGHT }}>
        {[...gridLines].reverse().map((h) => (
          <span key={h} className="-translate-y-2">
            {h.toFixed(1)}h
          </span>
        ))}
      </div>

      <div className="flex-1 relative border-l border-b border-border pb-8">
        <div className="absolute inset-x-0 top-0" style={{ height: CHART_HEIGHT }}>
          {gridLines.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-border/40"
              style={{ bottom: `${(h / maxHours) * 100}%` }}
            />
          ))}
        </div>

        <div className="flex items-end gap-3 px-3" style={{ height: CHART_HEIGHT }}>
          {days.map((day) => (
            <div key={day.date} className="flex-1 max-w-[44px] flex flex-col items-center h-full justify-end group">
              <div
                title={`${(day.totalSeconds / 3600).toFixed(2)}h`}
                className="w-full rounded-t overflow-hidden flex flex-col-reverse"
                style={{ height: `${(day.totalSeconds / (maxHours * 3600)) * 100}%`, minHeight: day.totalSeconds > 0 ? 2 : 0 }}
              >
                {day.segments.map((seg, i) => (
                  <div
                    key={i}
                    style={{
                      height: `${(seg.seconds / day.totalSeconds) * 100}%`,
                      backgroundColor: seg.color,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 px-3 absolute top-full mt-2 w-full">
          {days.map((day) => (
            <div key={day.date} className="flex-1 max-w-[44px] flex justify-center">
              <span className="text-xs text-muted whitespace-nowrap origin-top-left -rotate-[30deg] translate-x-2">
                {formatChartDayLabel(day.date)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
