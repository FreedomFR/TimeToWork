import { ReactNode } from "react";
import { Project, Tag } from "../api/types";
import { NO_DESCRIPTION_LABEL } from "../utils/constants";
import { formatClock, formatDuration } from "../utils/time";
import CountBadge from "./ui/CountBadge";
import ProjectLabel from "./ui/ProjectLabel";
import { IconCalendar, IconDollar, IconTag } from "./icons";

interface Props {
  description: string;
  project: Project | null;
  billable: boolean;
  tags: Tag[];
  /** ISO strings; a missing `end` is shown as "..." (still running). */
  start: string;
  end: string | null;
  seconds: number;
  /** Set for a group of identical entries: shows the count badge. */
  count?: number;
  onClick: () => void;
  /** Right-hand buttons (continue, menu…). Clicks on them don't trigger `onClick`. */
  actions: ReactNode;
}

/**
 * One clickable line of the time tracker: description, project, billable/tags
 * indicators, time range and total duration. Used both for a single entry and
 * for a group of identical entries.
 */
export default function EntrySummaryRow({
  description,
  project,
  billable,
  tags,
  start,
  end,
  seconds,
  count,
  onClick,
  actions,
}: Props) {
  return (
    <div onClick={onClick} className="flex items-center gap-3 px-4 py-3 hover:bg-surfaceAlt cursor-pointer">
      {count !== undefined && <CountBadge count={count} />}

      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-200 truncate">
          {description || <span className="text-muted">{NO_DESCRIPTION_LABEL}</span>}
        </span>
        {project && <ProjectLabel project={project} />}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {billable && <IconDollar className="w-3.5 h-3.5 text-accent" />}
        {tags.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <IconTag className="w-3.5 h-3.5" />
            {tags.map((t) => t.name).join(", ")}
          </span>
        )}
      </div>

      <div className="text-xs text-muted w-24 text-right shrink-0">
        {formatClock(start)} - {end ? formatClock(end) : "..."}
      </div>

      <IconCalendar className="w-4 h-4 text-muted shrink-0" />

      <div className="font-mono text-sm font-medium text-gray-200 w-20 text-right shrink-0">
        {formatDuration(seconds)}
      </div>

      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        {actions}
      </div>
    </div>
  );
}
