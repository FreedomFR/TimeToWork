import { useEffect, useRef, useState } from "react";
import { usePendingRequests } from "../../api/pending";

/** A request must last this long before the message appears: fast ones never flash it. */
const SHOW_AFTER_MS = 500;
/** Once shown, it stays at least this long, so it does not blink when the answer comes just after. */
const MIN_VISIBLE_MS = 600;

/**
 * "Veuillez patienter": a message in the middle of the page while the server is slow to answer.
 * It does not block anything (clicks go through). The clock's hand turns unless animations are off.
 */
export default function SlowRequestNotice() {
  const busy = usePendingRequests() > 0;
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (busy && !visible) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, SHOW_AFTER_MS);
      return () => clearTimeout(timer);
    }
    if (!busy && visible) {
      const timer = setTimeout(() => setVisible(false), Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current)));
      return () => clearTimeout(timer);
    }
  }, [busy, visible]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 pointer-events-none animate-fade-in"
    >
      <div className="flex items-center gap-5 bg-surface border border-border rounded-2xl shadow-2xl px-8 py-5">
        <svg viewBox="0 0 64 64" className="w-16 h-16 shrink-0" aria-hidden>
          <circle cx="32" cy="32" r="28" fill="none" strokeWidth="6" className="stroke-accent" />
          <line x1="32" y1="32" x2="32" y2="14" strokeWidth="4" strokeLinecap="round" className="stroke-white" />
          <g className="animate-clock-hand" style={{ transformOrigin: "32px 32px" }}>
            <line x1="32" y1="32" x2="46" y2="24" strokeWidth="4" strokeLinecap="round" className="stroke-gray-300" />
          </g>
          <circle cx="32" cy="32" r="4" className="fill-white" />
        </svg>
        <div>
          <p className="text-lg text-gray-100">Veuillez patienter</p>
          <p className="text-sm text-muted">Cela prend un peu plus de temps que prévu…</p>
        </div>
      </div>
    </div>
  );
}
