import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Client } from "../api/types";
import ManagedRow from "../components/ui/ManagedRow";
import { CARD_CLASS, INLINE_INPUT_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "../components/ui/styles";

type ClientPatch = Partial<Pick<Client, "name">>;

/** Inline rename panel shown under an expanded client row. */
function EditClientPanel({ client, onUpdate }: { client: Client; onUpdate: (id: string, patch: ClientPatch) => void }) {
  const [name, setName] = useState(client.name);

  function commitName() {
    if (name.trim() && name !== client.name) onUpdate(client.id, { name: name.trim() });
  }

  return (
    <div className="px-4 pb-3 pt-1 bg-bg/40">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        placeholder="Nom du client"
        className={`w-full ${INLINE_INPUT_CLASS}`}
      />
    </div>
  );
}

/** Clients page: create, rename, archive and delete clients. */
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

  async function handleUpdate(id: string, patch: ClientPatch) {
    const res = await api.put(`/clients/${id}`, patch);
    setClients((prev) => prev.map((c) => (c.id === id ? res.data : c)));
  }

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-4">Clients</h1>

      <div className={`${CARD_CLASS} p-4 mb-6 flex items-end gap-3`}>
        <div className="flex-1">
          <label className="block text-xs text-muted mb-1">Nom du client</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du client"
            className={`w-full ${INPUT_CLASS}`}
          />
        </div>
        <button onClick={handleCreate} className={`text-sm px-4 py-2 ${PRIMARY_BUTTON_CLASS}`}>
          + Ajouter
        </button>
      </div>

      <div className={CARD_CLASS}>
        {clients.map((c) => (
          <ManagedRow
            key={c.id}
            name={c.name}
            archived={c.archived}
            expanded={expandedId === c.id}
            onToggleExpanded={() => setExpandedId(expandedId === c.id ? null : c.id)}
            onToggleArchive={() => toggleArchive(c)}
            onDelete={() => handleDelete(c.id)}
          >
            <EditClientPanel client={c} onUpdate={handleUpdate} />
          </ManagedRow>
        ))}
        {clients.length === 0 && <div className="text-center text-muted text-sm py-10">Aucun client créé</div>}
      </div>
    </div>
  );
}
