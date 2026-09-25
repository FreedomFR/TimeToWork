import { useState } from "react";
import LogsPanel from "../components/admin/LogsPanel";
import UsersPanel from "../components/admin/UsersPanel";

const TABS = ["Utilisateurs", "Journaux"] as const;
type Tab = (typeof TABS)[number];

/**
 * Administration (admins only): manage who is an administrator, and read the application
 * journal. Access is enforced by the server; the route guard only hides the page.
 */
export default function Admin() {
  const [tab, setTab] = useState<Tab>("Utilisateurs");

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-4">Administration</h1>

      <div className="flex items-center gap-1 mb-6" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm rounded transition-colors ${
              tab === t ? "bg-surfaceAlt text-gray-100" : "text-muted hover:text-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Utilisateurs" ? <UsersPanel /> : <LogsPanel />}
    </div>
  );
}
