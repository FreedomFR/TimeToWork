import { useState } from "react";
import { formatDuration, parseDurationInput } from "../../utils/time";

interface Props {
  /** Current duration, shown as the placeholder until the user types. */
  seconds: number;
  /** Called with the parsed duration when the user commits a valid value. */
  onCommit: (seconds: number) => void;
  className: string;
  ariaLabel?: string;
  title?: string;
}

/**
 * Free-form duration field ("1:30", "90"…). The current value is displayed as a
 * placeholder; typing and leaving the field (blur / Enter) commits the new duration.
 */
export default function DurationInput({ seconds, onCommit, className, ariaLabel, title }: Props) {
  const [draft, setDraft] = useState("");

  function commit() {
    const parsed = parseDurationInput(draft);
    setDraft("");
    if (parsed !== null) onCommit(parsed);
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      placeholder={formatDuration(seconds)}
      aria-label={ariaLabel}
      title={title}
      className={className}
    />
  );
}
