import { Fragment, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { AdminUser, LogLevel, LogPage, LogSummary, LogType } from "../../api/types";
import { useDebounced } from "../../hooks/useDebounced";
import { apiErrorMessage } from "../../utils/errors";
import { LOG_LEVEL_LABELS, LOG_LEVEL_STYLES, LOG_TYPE_LABELS } from "../../utils/logLabels";
import { endOfDay, startOfDay } from "../../utils/time";
import { CARD_CLASS, INPUT_CLASS } from "../ui/styles";
import { IconChevronDown } from "../icons";

type SortKey = "date" | "level" | "type" | "user";
type Order = "asc" | "desc";

const PAGE_SIZES = [25, 50, 100];

interface Filters {
  userId: string;
  type: LogType | "";
  level: LogLevel | "";
  from: string; // YYYY-MM-DD
  to: string;
  search: string;
}

const NO_FILTERS: Filters = { userId: "", type: "", level: "", from: "", to: "", search: "" };

/** Date and time to the second: journal lines are often compared to the second. */
function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" });
}

/** Query parameters shared by the list and the summary (dates become whole local days). */
function filterParams(f: Filters) {
  return {
    userId: f.userId || undefined,
    from: f.from ? startOfDay(new Date(`${f.from}T00:00:00`)).toISOString() : undefined,
    to: f.to ? endOfDay(new Date(`${f.to}T00:00:00`)).toISOString() : undefined,
    q: f.search.trim() || undefined,
  };
}

/**
 * Admin "Journaux" tab: the application journal, filterable by person, type of bug, level, period and
 * free text, sortable by clicking a column header, paginated. A line expands to show its details
 * (stack trace…), always displayed as plain text.
 */
export default function LogsPanel() {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<SortKey>("date");
  const [order, setOrder] = useState<Order>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reloadKey, setReloadKey] = useState(0);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [data, setData] = useState<LogPage | null>(null);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Wait for the end of typing before querying
  const debouncedSearch = useDebounced(filters.search);
  const query = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch]
  );

  useEffect(() => {
    api.get("/admin/users").then((res) => setUsers(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = filterParams(query);

    Promise.all([
      api.get("/admin/logs", {
        params: { ...params, type: query.type || undefined, level: query.level || undefined, sort, order, page, pageSize },
      }),
      api.get("/admin/logs/summary", { params }),
    ])
      .then(([list, counts]) => {
        if (cancelled) return;
        setData(list.data);
        setSummary(counts.data);
        setError("");
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err, "Impossible de charger le journal")))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query, sort, order, page, pageSize, reloadKey]);

  /** Changes a filter and goes back to the first page. */
  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sort === key) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setOrder(key === "date" ? "desc" : "asc");
    }
    setPage(1);
  }

  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  function sortHeader(key: SortKey, label: string) {
    const active = sort === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (order === "asc" ? "ascending" : "descending") : "none"}
        className="font-normal px-4 py-3 text-left"
      >
        <button onClick={() => toggleSort(key)} className={`flex items-center gap-1 hover:text-gray-200 ${active ? "text-gray-100" : ""}`}>
          {label}
          <IconChevronDown className={`w-3 h-3 transition-transform ${active ? (order === "asc" ? "rotate-180" : "") : "opacity-30"}`} />
        </button>
      </th>
    );
  }

  return (
    <div>
      {/* Counters per type of bug: a click filters on that type */}
      {summary && (
        <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Répartition par type">
          {summary.types.map((t) => {
            const count = summary.byType[t] ?? 0;
            const selected = filters.type === t;
            return (
              <button
                key={t}
                onClick={() => setFilter("type", selected ? "" : t)}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                  selected ? "border-accent bg-accent/10 text-gray-100" : "border-border text-gray-300 hover:bg-surfaceAlt"
                }`}
              >
                {LOG_TYPE_LABELS[t]} <span className="ml-1 font-mono text-muted">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className={`${CARD_CLASS} p-4 mb-4 flex flex-wrap items-end gap-3`}>
        <label className="text-xs text-muted">
          Personne
          <select
            value={filters.userId}
            aria-label="Filtrer par personne"
            onChange={(e) => setFilter("userId", e.target.value)}
            className={`block mt-1 ${INPUT_CLASS} max-w-[220px]`}
          >
            <option value="">Toutes</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Type
          <select value={filters.type} aria-label="Filtrer par type" onChange={(e) => setFilter("type", e.target.value as LogType | "")} className={`block mt-1 ${INPUT_CLASS}`}>
            <option value="">Tous</option>
            {(summary?.types ?? []).map((t) => (
              <option key={t} value={t}>
                {LOG_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Niveau
          <select value={filters.level} aria-label="Filtrer par niveau" onChange={(e) => setFilter("level", e.target.value as LogLevel | "")} className={`block mt-1 ${INPUT_CLASS}`}>
            <option value="">Tous</option>
            {(["error", "warn", "info"] as LogLevel[]).map((l) => (
              <option key={l} value={l}>
                {LOG_LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Du
          <input type="date" value={filters.from} aria-label="Date de début" onChange={(e) => setFilter("from", e.target.value)} className={`block mt-1 ${INPUT_CLASS}`} />
        </label>
        <label className="text-xs text-muted">
          Au
          <input type="date" value={filters.to} aria-label="Date de fin" onChange={(e) => setFilter("to", e.target.value)} className={`block mt-1 ${INPUT_CLASS}`} />
        </label>
        <label className="text-xs text-muted flex-1 min-w-[180px]">
          Recherche
          <input
            type="search"
            aria-label="Rechercher dans le journal"
            placeholder="Message, route, email, détails…"
            value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)}
            className={`block mt-1 w-full ${INPUT_CLASS}`}
          />
        </label>
        {filtered && (
          <button
            onClick={() => {
              setFilters(NO_FILTERS);
              setPage(1);
            }}
            className="text-sm text-accent hover:underline pb-2"
          >
            Réinitialiser
          </button>
        )}
        <button onClick={() => setReloadKey((k) => k + 1)} className="text-sm text-gray-300 hover:text-white pb-2 ml-auto">
          Actualiser
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400 bg-red-500/10 rounded px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className={`${CARD_CLASS} overflow-x-auto`}>
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-xs text-muted border-b border-border">
              {sortHeader("date", "DATE")}
              {sortHeader("level", "NIVEAU")}
              {sortHeader("type", "TYPE")}
              {sortHeader("user", "PERSONNE")}
              <th scope="col" className="font-normal px-4 py-3 text-left">MESSAGE</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((entry) => {
              const open = expanded === entry.id;
              return (
                <Fragment key={entry.id}>
                  <tr
                    data-testid="log-row"
                    onClick={() => setExpanded(open ? null : entry.id)}
                    className="border-b border-border hover:bg-surfaceAlt cursor-pointer align-top"
                  >
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap font-mono text-xs">{formatWhen(entry.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${LOG_LEVEL_STYLES[entry.level]}`}>{LOG_LEVEL_LABELS[entry.level]}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-200 whitespace-nowrap">{LOG_TYPE_LABELS[entry.type] ?? entry.type}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {entry.user ? entry.user.name : entry.userEmail ? "(compte supprimé)" : "—"}
                      {(entry.user?.email ?? entry.userEmail) && (
                        <div className="text-xs text-muted">{entry.user?.email ?? entry.userEmail}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-200">
                      <div className="break-words">{entry.message}</div>
                      {entry.path && (
                        <div className="text-xs text-muted font-mono mt-0.5 break-all">
                          {entry.method} {entry.path}
                          {entry.statusCode ? ` → ${entry.statusCode}` : ""}
                        </div>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr className="border-b border-border bg-bg/40">
                      <td colSpan={5} className="px-4 py-3">
                        {entry.details ? (
                          <pre data-testid="log-details" className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono max-h-64 overflow-auto">
                            {entry.details}
                          </pre>
                        ) : (
                          <p className="text-xs text-muted">Aucun détail.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {!loading && data && data.items.length === 0 && (
          <p className="text-center text-muted text-sm py-10">Aucune entrée pour ces filtres</p>
        )}
      </div>

      {data && (
        <div className="flex items-center justify-between flex-wrap gap-3 mt-4 text-sm text-muted">
          <span>
            {data.total} entrée(s) · page {data.page} / {data.totalPages}
          </span>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2">
              Par page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className={INPUT_CLASS}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              className="px-3 py-2 rounded bg-surfaceAlt text-gray-200 disabled:opacity-40"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.totalPages}
              className="px-3 py-2 rounded bg-surfaceAlt text-gray-200 disabled:opacity-40"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
