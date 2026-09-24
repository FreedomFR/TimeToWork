import { useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { IconChevronDown } from "../icons";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/** Filter-bar dropdown with a "contains…" text box; applied on Enter or the "Appliquer" button. */
export default function DescriptionFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  function apply() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen((o) => !o);
        }}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded hover:bg-surfaceAlt whitespace-nowrap ${
          value ? "text-gray-100" : "text-gray-300"
        }`}
      >
        Description
        <IconChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 w-64 bg-surface border border-border rounded shadow-lg p-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && apply()}
            placeholder="Contient..."
            className="w-full bg-surfaceAlt border-none rounded px-2 py-1.5 text-sm text-gray-200 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            onClick={apply}
            className="w-full mt-2 bg-accent hover:bg-accentDark text-white text-xs font-medium rounded py-1.5"
          >
            Appliquer
          </button>
        </div>
      )}
    </div>
  );
}
