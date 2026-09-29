import { useEffect, useState } from "react";
import { usePendingRequests } from "../../api/pending";

/**
 * "Veuillez patienter": a message in the middle of the page for as long as the app is waiting for
 * the server, gone as soon as the data is on screen. It does not block anything (clicks go through)
 * and fades in, so a very fast answer only makes it flicker faintly. The clock's hand turns unless
 * animations are off.
 */
export default function SlowRequestNotice() {
  const busy = usePendingRequests() > 0;
  const [visible, setVisible] = useState(busy);

  useEffect(() => {
    if (busy) {
      setVisible(true);
      return;
    }
    // The answer that ended the wait is turned into screen content in the next render or two:
    // hiding after two frames means the message goes when the data appears, not just before.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setVisible(false));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [busy]);

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
          <p className="text-sm text-muted">Chargement en cours…</p>
        </div>
      </div>
    </div>
  );
}
