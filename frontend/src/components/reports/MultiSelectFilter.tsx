import { useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { IconChevronDown } from "../icons";

interface Option {
  id: string;
  label: string;
  color?: string;
}

interface Props {
  label: string;
  options: Option[];
  value: string[];
  onChange: (ids: string[]) => void;
}

/** Filter-bar dropdown with checkboxes; shows a badge with the number of selected options. */
export default function MultiSelectFilter({ label, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded hover:bg-surfaceAlt whitespace-nowrap ${
          value.length > 0 ? "text-gray-100" : "text-gray-300"
        }`}
      >
        {label}
        {value.length > 0 && (
          <span className="text-xs bg-accent text-white rounded-full w-4 h-4 flex items-center justify-center">
            {value.length}
          </span>
        )}
        <IconChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 left-0 w-56 bg-surface border border-border rounded shadow-lg overflow-hidden">
          <div className="max-h-64 overflow-y-auto">
            {options.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surfaceAlt cursor-pointer text-gray-200"
              >
                <input
                  type="checkbox"
                  checked={value.includes(opt.id)}
                  onChange={() => toggle(opt.id)}
                  className="accent-accent"
                />
                {opt.color && (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                )}
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
            {options.length === 0 && <p className="px-3 py-2 text-sm text-muted">Aucune option</p>}
          </div>
          {value.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-surfaceAlt border-t border-border"
            >
              Effacer la sélection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
