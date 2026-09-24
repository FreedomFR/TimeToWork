import { useState, useRef, useEffect } from "react";
import { Project } from "../api/types";
import { IconPlus } from "./icons";

interface Props {
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
}

export default function ProjectSelect({ projects, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = projects.find((p) => p.id === value) || null;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-2 text-sm rounded hover:bg-surfaceAlt max-w-[160px] text-left"
      >
        {selected ? (
          <>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selected.color }}
            />
            <span className="truncate" style={{ color: selected.color }}>
              {selected.name}
            </span>
          </>
        ) : (
          <>
            <IconPlus className="w-4 h-4 text-accent shrink-0" />
            <span className="text-accent whitespace-nowrap">Projet</span>
          </>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-64 bg-surface border border-border rounded shadow-lg max-h-64 overflow-y-auto">
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm text-muted hover:bg-surfaceAlt"
          >
            Aucun projet
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(p.id);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-surfaceAlt flex items-center gap-2 text-gray-200"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="truncate">{p.name}</span>
              {p.client && (
                <span className="text-xs text-muted ml-auto truncate">{p.client.name}</span>
              )}
            </button>
          ))}
          {projects.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted">Aucun projet créé</p>
          )}
        </div>
      )}
    </div>
  );
}
