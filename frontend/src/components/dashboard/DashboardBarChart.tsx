import { Bucket } from "../../utils/dashboard";
import { formatDuration } from "../../utils/time";

interface Props {
  buckets: Bucket[];
}

const CHART_HEIGHT = 240;
// Beyond this many bars the value above each bar no longer fits and moves to a tooltip.
const MAX_LABELLED_BARS = 14;

export default function DashboardBarChart({ buckets }: Props) {
  const maxSeconds = Math.max(0, ...buckets.map((b) => b.totalSeconds));
  const maxHours = Math.max(1, Math.ceil(maxSeconds / 3600));
  const step = Math.max(1, Math.ceil(maxHours / 7));
  const gridLines: number[] = [];
  for (let h = step; h <= maxHours; h += step) gridLines.push(h);
  const scaleHours = gridLines[gridLines.length - 1] ?? maxHours;
  const labelled = buckets.length <= MAX_LABELLED_BARS;
  const rotated = buckets.length > 10;

  return (
    <div className="flex" data-testid="dashboard-bar-chart">
      <div className="relative shrink-0 w-10 text-xs text-muted" style={{ height: CHART_HEIGHT }}>
        {gridLines.map((h) => (
          <span
            key={h}
            className="absolute right-2 translate-y-1/2"
            style={{ bottom: `${(h / scaleHours) * 100}%` }}
          >
            {h.toFixed(1)}h
          </span>
        ))}
      </div>

      <div className="flex-1 min-w-0">
        <div className="relative border-b border-border" style={{ height: CHART_HEIGHT }}>
          {gridLines.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 border-t border-dotted border-border"
              style={{ bottom: `${(h / scaleHours) * 100}%` }}
            />
          ))}

          <div className="absolute inset-0 flex items-end gap-4 px-4">
            {buckets.map((b) => {
              const heightPct = (b.totalSeconds / (scaleHours * 3600)) * 100;
              return (
                <div key={b.key} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center">
                  {labelled && (
                    <span className="text-xs text-gray-200 mb-1 font-mono whitespace-nowrap">
                      {formatDuration(b.totalSeconds)}
                    </span>
                  )}
                  <div
                    title={`${b.label} : ${formatDuration(b.totalSeconds)}`}
                    className="w-full flex flex-col-reverse overflow-hidden"
                    style={{ height: `${heightPct}%`, minHeight: b.totalSeconds > 0 ? 2 : 0 }}
                  >
                    {b.segments.map((seg, i) => (
                      <div
                        key={i}
                        style={{
                          height: `${(seg.seconds / b.totalSeconds) * 100}%`,
                          backgroundColor: seg.color,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={`flex gap-4 px-4 pt-2 ${rotated ? "pb-8" : ""}`}>
          {buckets.map((b) => (
            <div key={b.key} className="flex-1 min-w-0 text-center">
              <span
                className={`text-xs text-gray-300 inline-block ${
                  rotated ? "whitespace-nowrap origin-top-left -rotate-[35deg] translate-x-3" : "break-words"
                }`}
              >
                {b.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
