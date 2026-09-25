import { useEffect, useRef } from "react";
import { TimeEntry } from "../../api/types";
import { CalendarDay, CalendarEvent, MINUTES_PER_DAY } from "../../utils/calendar";
import { NEUTRAL_COLOR, NO_DESCRIPTION_LABEL } from "../../utils/constants";
import { durationSeconds, formatClock, formatDuration, sameDay } from "../../utils/time";
import { IconZoomOut, IconZoomIn } from "../icons";

interface Props {
  days: CalendarDay[];
  /** Pixels per hour: the zoom level. */
  hourHeight: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  /** Whether the zoom buttons can still go further in each direction. */
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** Called when a block is clicked (or activated with Enter / Space). */
  onSelectEntry: (entry: TimeEntry) => void;
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const AXIS_WIDTH = 56;
/** Hour shown at the top when the day has no entry. */
const DEFAULT_TOP_HOUR = 8;
/** Below these block heights (px) the project line / bottom-right duration are dropped. */
const MIN_HEIGHT_FOR_PROJECT = 56;
const MIN_HEIGHT_FOR_FOOTER_DURATION = 40;

function dayHeaderLabel(d: Date): string {
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "short" });
  const month = d.toLocaleDateString("fr-FR", { month: "short" });
  return `${weekday}, ${month} ${d.getDate()}`;
}

/** One entry block, absolutely positioned in its day column. */
function EventBlock({
  event,
  hourHeight,
  onSelect,
}: {
  event: CalendarEvent;
  hourHeight: number;
  onSelect: (entry: TimeEntry) => void;
}) {
  const { entry, startMin, endMin, column, columns } = event;
  const color = entry.project?.color || NEUTRAL_COLOR;
  const seconds = durationSeconds(entry.start, entry.end);
  const height = Math.max(((endMin - startMin) / 60) * hourHeight, 16);
  const description = entry.description || NO_DESCRIPTION_LABEL;
  const projectLine = entry.project
    ? `${entry.project.name}${entry.project.client ? ` - ${entry.project.client.name}` : ""}`
    : null;
  const tooltip = [
    description,
    projectLine,
    `${formatClock(entry.start)} - ${entry.end ? formatClock(entry.end) : "..."} (${formatDuration(seconds)})`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      data-testid="calendar-event"
      role="button"
      tabIndex={0}
      title={tooltip}
      onClick={() => onSelect(entry)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(entry);
        }
      }}
      className="absolute px-0.5 cursor-pointer group focus:outline-none"
      style={{
        top: (startMin / 60) * hourHeight,
        height,
        left: `${(column / columns) * 100}%`,
        width: `${100 / columns}%`,
      }}
    >
      <div
        className="relative h-full overflow-hidden rounded-sm bg-bg text-xs text-gray-200 px-2 py-1 group-hover:brightness-125 group-focus-visible:ring-2 group-focus-visible:ring-accent"
        style={{ borderLeft: `3px solid ${color}` }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className={`break-words leading-snug ${entry.description ? "" : "text-muted"}`}>{description}</span>
          {height < MIN_HEIGHT_FOR_FOOTER_DURATION && (
            <span className="font-mono shrink-0 leading-snug">{formatDuration(seconds)}</span>
          )}
        </div>
        {projectLine && height >= MIN_HEIGHT_FOR_PROJECT && (
          <p className="mt-1.5 truncate text-muted">
            <span style={{ color }}>{entry.project!.name}</span>
            {entry.project!.client && (
              <>
                {" - "}
                <span className="text-gray-300">{entry.project!.client.name}</span>
              </>
            )}
          </p>
        )}
        {height >= MIN_HEIGHT_FOR_FOOTER_DURATION && (
          <span className="absolute bottom-1 right-2 font-mono">{formatDuration(seconds)}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Time grid of the calendar: an hour axis on the left and one column per day.
 * Header (day + total) and the zoom corner stay pinned while the grid scrolls;
 * on load the grid scrolls to just above the earliest entry.
 */
export default function CalendarGrid({
  days,
  hourHeight,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
  onSelectEntry,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Re-scroll when the set of displayed days / entries changes (not on zoom)
  const firstStart = Math.min(MINUTES_PER_DAY, ...days.flatMap((d) => d.events.map((e) => e.startMin)));
  const hasEvents = firstStart < MINUTES_PER_DAY;
  const daysKey = days.map((d) => `${d.key}:${d.events.length}`).join("|");
  useEffect(() => {
    const topHour = hasEvents ? Math.max(0, Math.floor(firstStart / 60) - 1) : DEFAULT_TOP_HOUR;
    if (scrollRef.current) scrollRef.current.scrollTop = topHour * hourHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey]);

  const gridTemplateColumns = `${AXIS_WIDTH}px repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto rounded-lg border border-border bg-surface">
      {/* Pinned header: zoom buttons + one label and total per day */}
      <div className="sticky top-0 z-10 grid bg-surface border-b border-border" style={{ gridTemplateColumns }}>
        <div className="flex items-center justify-center gap-1 py-3">
          <button
            type="button"
            title="Zoom arrière"
            aria-label="Zoom arrière"
            onClick={onZoomOut}
            disabled={!canZoomOut}
            className="w-6 h-6 rounded bg-surfaceAlt text-gray-300 hover:text-white disabled:opacity-30 flex items-center justify-center"
          >
            <IconZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Zoom avant"
            aria-label="Zoom avant"
            onClick={onZoomIn}
            disabled={!canZoomIn}
            className="w-6 h-6 rounded bg-surfaceAlt text-gray-300 hover:text-white disabled:opacity-30 flex items-center justify-center"
          >
            <IconZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
        {days.map((day) => (
          <div
            key={day.key}
            data-testid="calendar-day-header"
            className="py-2 text-center text-xs text-gray-200 border-l border-border"
          >
            <div className={sameDay(day.date, now) ? "text-accent font-medium" : ""}>{dayHeaderLabel(day.date)}</div>
            <div className="font-mono mt-0.5">{formatDuration(day.totalSeconds)}</div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns }}>
        <div className="relative" style={{ height: 24 * hourHeight }}>
          {HOURS.slice(1).map((h) => (
            <span
              key={h}
              className="absolute right-2 -translate-y-1/2 text-xs text-muted"
              style={{ top: h * hourHeight }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {days.map((day) => {
          const weekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          return (
            <div
              key={day.key}
              data-testid="calendar-day"
              className={`relative border-l border-border ${weekend ? "bg-bg/50" : ""}`}
              style={{ height: 24 * hourHeight }}
            >
              {HOURS.slice(1).map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 border-t border-dashed border-border"
                  style={{ top: h * hourHeight }}
                />
              ))}

              {day.events.map((event) => (
                <EventBlock key={event.entry.id} event={event} hourHeight={hourHeight} onSelect={onSelectEntry} />
              ))}

              {sameDay(day.date, now) && (
                <div
                  aria-hidden
                  className="absolute left-0 right-0 border-t-2 border-red-500/70 pointer-events-none"
                  style={{ top: (nowMin / 60) * hourHeight }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
