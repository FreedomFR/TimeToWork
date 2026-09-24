import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Client } from "../api/types";

function EditClientPanel({
  client,
  onUpdate,
}: {
  client: Client;
  onUpdate: (id: string, patch: Partial<{ name: string }>) => void;
}) {
  const [name, setName] = useState(client.name);

  function commitName() {
    if (name.trim() && name !== client.name) onUpdate(client.id, { name: name.trim() });
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="px-4 pb-3 pt-1 bg-bg/40">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        placeholder="Nom du client"
        className="w-full bg-surfaceAlt border-none rounded px-2 py-1.5 text-sm text-gray-200 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    const res = await api.get("/clients");
    setClients(res.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    await api.post("/clients", { name });
    setName("");
    load();
  }

  async function handleDelete(id: string) {
    await api.delete(`/clients/${id}`);
    load();
  }

  async function toggleArchive(client: Client) {
    await api.put(`/clients/${client.id}`, { archived: !client.archived });
    load();
  }

  async function handleUpdate(id: string, patch: Partial<{ name: string }>) {
    const res = await api.put(`/clients/${id}`, patch);
    setClients((prev) => prev.map((c) => (c.id === id ? res.data : c)));
  }

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-4">Clients</h1>

      <div className="bg-surface rounded-lg border border-border p-4 mb-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-muted mb-1">Nom du client</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du client"
            className="w-full bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <button
          onClick={handleCreate}
          className="bg-accent hover:bg-accentDark text-white text-sm font-medium px-4 py-2 rounded transition-colors"
        >
          + Ajouter
        </button>
      </div>

      <div className="bg-surface rounded-lg border border-border">
        {clients.map((c) => (
          <div key={c.id} className="border-b border-border last:border-b-0">
            <div
              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surfaceAlt cursor-pointer"
            >
              <span className={`text-sm flex-1 ${c.archived ? "text-muted line-through" : "text-gray-200"}`}>
                {c.name}
              </span>
              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleArchive(c)}
                  className="text-xs text-muted hover:text-gray-200 px-2"
                >
                  {c.archived ? "Réactiver" : "Archiver"}
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-2"
                >
                  Supprimer
                </button>
              </div>
            </div>
            {expandedId === c.id && <EditClientPanel client={c} onUpdate={handleUpdate} />}
          </div>
        ))}
        {clients.length === 0 && (
          <div className="text-center text-muted text-sm py-10">Aucun client créé</div>
        )}
      </div>
    </div>
  );
}
