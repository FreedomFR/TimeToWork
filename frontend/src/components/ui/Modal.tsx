import { ReactNode, useEffect } from "react";
import { IconClose } from "../icons";

interface Props {
  title: string;
  /** Small line under the title. */
  subtitle?: string;
  onClose: () => void;
  /** Buttons row pinned at the bottom. */
  footer: ReactNode;
  children: ReactNode;
  /** Tailwind max-width class of the panel. */
  widthClass?: string;
}

/**
 * Centered modal dialog: dark backdrop, title bar with a close button, body and a footer.
 * The backdrop scrolls when the panel is taller than the screen; the panel itself never clips,
 * so dropdowns opened inside it (tags, menus) can extend past its edges.
 * Closes on Escape, on the ✕ button and on a click outside the panel.
 * The panel is exposed as `role="dialog"` labelled by `title`.
 */
export default function Modal({ title, subtitle, onClose, footer, children, widthClass = "max-w-lg" }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${widthClass} m-auto bg-surface border border-border rounded-lg shadow-xl`}
      >
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-100">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-muted hover:text-gray-200 -mr-1">
            <IconClose className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">{children}</div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}
