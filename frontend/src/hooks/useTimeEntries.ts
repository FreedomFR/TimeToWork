import { useEffect, useState } from "react";
import { api } from "../api/client";
import { TimeEntry } from "../api/types";

/**
 * Loads the time entries starting within [from, to] and re-fetches whenever
 * the range changes. A response that arrives after the range changed again is
 * ignored, so a slow request can never overwrite a newer one.
 *
 * `setEntries` is exposed so pages can apply optimistic updates after edits.
 */
export function useTimeEntries(from: Date, to: Date) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fromMs = from.getTime();
  const toMs = to.getTime();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/time-entries", { params: { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() } })
      .then((res) => {
        if (!cancelled) setEntries(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromMs, toMs]);

  return { entries, setEntries, loading };
}
