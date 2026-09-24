import { useRef } from "react";
import { IconCalendar } from "../icons";

interface Props {
  /** `YYYY-MM-DD` */
  value: string;
  onChange: (date: string) => void;
  /** Text shown on the button (e.g. "Aujourd'hui"). */
  label: string;
  /** Vertical padding class, to fit the surrounding row height. */
  paddingY?: string;
}

/**
 * Button showing a date label that opens the native date picker.
 * The real `<input type="date">` stays invisible; the button only triggers it.
 */
export default function DatePickerButton({ value, onChange, label, paddingY = "py-2" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.showPicker?.() ?? inputRef.current?.focus()}
        className={`flex items-center gap-1.5 px-2.5 text-sm rounded hover:bg-surfaceAlt text-gray-300 whitespace-nowrap ${paddingY}`}
      >
        <IconCalendar className="w-4 h-4 text-muted" />
        {label}
      </button>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
      />
    </div>
  );
}
