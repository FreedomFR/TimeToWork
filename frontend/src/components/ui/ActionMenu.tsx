import { ReactNode, useRef, useState } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { IconMore } from "../icons";

export interface ActionMenuItem {
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /** Renders the item in red (destructive actions). */
  danger?: boolean;
}

/** "⋮" button opening a small dropdown of actions. Closes on selection or outside click. */
interface Props {
  items: ActionMenuItem[];
  /** Where the dropdown opens: below (default, right-aligned) or above (left-aligned, for menus at the bottom of a modal). */
  direction?: "down" | "up";
}

export default function ActionMenu({ items, direction = "down" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title="Plus d'options"
        className="p-1.5 text-muted hover:text-gray-200 rounded"
      >
        <IconMore />
      </button>
      {open && (
        <div
          className={`absolute z-20 w-40 ${
            direction === "up" ? "left-0 bottom-full mb-1" : "right-0 mt-1"
          } bg-surface border border-border rounded shadow-lg overflow-hidden`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-surfaceAlt ${
                item.danger ? "text-red-400" : "text-gray-200"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
