import { RefObject, useEffect } from "react";

/**
 * Calls `onOutside` when the user presses the mouse anywhere outside `ref`.
 * Used by every dropdown/popover to close itself.
 */
export function useClickOutside(ref: RefObject<HTMLElement>, onOutside: () => void) {
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
    // `onOutside` is intentionally not a dependency: callers pass inline
    // closures and only ever call state setters, so the latest one is not needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
