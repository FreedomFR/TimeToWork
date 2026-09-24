import { useState } from "react";
import { parseTimeInput } from "../utils/time";

interface Props {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

export default function TimeInput({ value, onChange, className = "", ariaLabel }: Props) {
  const [editing, setEditing] = useState<string | null>(null);

  function commit() {
    if (editing === null) return;
    const parsed = parseTimeInput(editing);
    if (parsed && parsed !== value) onChange(parsed);
    setEditing(null);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={editing ?? value}
      onFocus={(e) => {
        setEditing(value);
        e.target.select();
      }}
      onChange={(e) => setEditing(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className={
        className ||
        "bg-surfaceAlt border-none rounded px-2 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent w-[72px] text-center"
      }
    />
  );
}
