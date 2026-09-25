import { useState } from "react";
import { EntryPatch, Project, Tag, TimeEntry } from "../api/types";
import { areContiguous, contiguousRuns } from "../utils/grouping";
import { durationSeconds } from "../utils/time";
import EntryRow from "./EntryRow";
import EntrySummaryRow from "./EntrySummaryRow";
import ActionMenu from "./ui/ActionMenu";
import { IconMerge, IconPlay } from "./icons";

interface Props {
  /** Entries of the same day sharing description, project, billable flag and tags. */
  entries: TimeEntry[];
  projects: Project[];
  tags: Tag[];
  onContinue: (entry: TimeEntry) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: EntryPatch) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  /** Merges the given entries (all of this group) into one. */
  onMerge: (ids: string[]) => Promise<void>;
}

/**
 * Renders a day's identical entries. A lone entry is shown as a plain `EntryRow`;
 * several are collapsed into one summary line (count + total) that expands to
 * the individual, editable rows.
 */
export default function EntryGroup({
  entries,
  projects,
  tags,
  onContinue,
  onDelete,
  onUpdate,
  onCreateTag,
  onMerge,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const rowProps = { projects, tags, onContinue, onDelete, onUpdate, onCreateTag };

  if (entries.length === 1) {
    return <EntryRow entry={entries[0]} {...rowProps} />;
  }

  const first = entries[0];
  const totalSeconds = entries.reduce((sum, e) => sum + durationSeconds(e.start, e.end), 0);
  const chronological = [...entries].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const latest = chronological[chronological.length - 1];

  // Pieces of the same mission that follow each other without a pause can be merged into one
  const mergeableRuns = contiguousRuns(chronological);

  async function mergeAllRuns() {
    for (const run of mergeableRuns) await onMerge(run.map((e) => e.id));
  }

  return (
    <div className="border-b border-border last:border-b-0">
      <EntrySummaryRow
        count={entries.length}
        description={first.description}
        project={first.project}
        billable={first.billable}
        tags={first.tags}
        start={chronological[0].start}
        end={latest.end}
        seconds={totalSeconds}
        onClick={() => setExpanded((e) => !e)}
        actions={
          <>
            {/* "Continue" restarts the most recent entry of the group */}
            <button onClick={() => onContinue(latest)} title="Continuer" className="p-1.5 text-muted hover:text-accent rounded">
              <IconPlay />
            </button>
            {mergeableRuns.length > 0 ? (
              <ActionMenu
                items={[
                  {
                    label: "Fusionner les créneaux consécutifs",
                    icon: <IconMerge className="w-4 h-4" />,
                    onSelect: mergeAllRuns,
                  },
                ]}
              />
            ) : (
              // Spacer keeping the column aligned with single rows, which have a menu button
              <span className="w-7" />
            )}
          </>
        }
      />

      {expanded && (
        <div className="bg-bg/30 divide-y divide-border">
          {chronological.map((entry, i) => {
            const previous = chronological[i - 1];
            const next = chronological[i + 1];
            return (
              <EntryRow
                key={entry.id}
                entry={entry}
                {...rowProps}
                onMergeWithPrevious={
                  previous && areContiguous(previous, entry) ? () => onMerge([previous.id, entry.id]) : undefined
                }
                onMergeWithNext={next && areContiguous(entry, next) ? () => onMerge([entry.id, next.id]) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
