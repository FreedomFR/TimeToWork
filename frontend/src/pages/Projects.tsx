import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Client, Project } from "../api/types";

const COLORS = [
  "#03A9F4", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5",
  "#009688", "#4CAF50", "#FF9800", "#795548", "#607D8B",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full shrink-0 ${
            value === c ? "ring-2 ring-offset-2 ring-offset-surface ring-gray-400" : ""
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function EditProjectPanel({
  project,
  clients,
  onUpdate,
}: {
  project: Project;
  clients: Client[];
  onUpdate: (id: string, patch: Partial<{ name: string; color: string; clientId: string | null }>) => void;
}) {
  const [name, setName] = useState(project.name);

  function commitName() {
    if (name.trim() && name !== project.name) onUpdate(project.id, { name: name.trim() });
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-3 flex-wrap px-4 pb-3 pt-1 bg-bg/40"
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        placeholder="Nom du projet"
        className="flex-1 min-w-[160px] bg-surfaceAlt border-none rounded px-2 py-1.5 text-sm text-gray-200 placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
      />
      <select
        value={project.clientId || ""}
        onChange={(e) => onUpdate(project.id, { clientId: e.target.value || null })}
        className="bg-surfaceAlt border-none rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <option value="">Aucun client</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ColorPicker value={project.color} onChange={(color) => onUpdate(project.id, { color })} />
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [clientId, setClientId] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    const [p, c] = await Promise.all([api.get("/projects"), api.get("/clients")]);
    setProjects(p.data);
    setClients(c.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    await api.post("/projects", { name, color, clientId: clientId || null });
    setName("");
    setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    setClientId("");
    load();
  }

  async function handleDelete(id: string) {
    await api.delete(`/projects/${id}`);
    load();
  }

  async function toggleArchive(project: Project) {
    await api.put(`/projects/${project.id}`, { archived: !project.archived });
    load();
  }

  async function handleUpdate(
    id: string,
    patch: Partial<{ name: string; color: string; clientId: string | null }>
  ) {
    const res = await api.put(`/projects/${id}`, patch);
    setProjects((prev) => prev.map((p) => (p.id === id ? res.data : p)));
  }

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-4">Projets</h1>

      <div className="bg-surface rounded-lg border border-border p-4 mb-6 flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-muted mb-1">Nom du projet</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du projet"
            className="w-full bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Client</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="">Aucun</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Couleur</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <button
          onClick={handleCreate}
          className="bg-accent hover:bg-accentDark text-white text-sm font-medium px-4 py-2 rounded transition-colors"
        >
          + Ajouter
        </button>
      </div>

      <div className="bg-surface rounded-lg border border-border">
        {projects.map((p) => (
          <div key={p.id} className="border-b border-border last:border-b-0">
            <div
              onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surfaceAlt cursor-pointer"
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className={`text-sm flex-1 ${p.archived ? "text-muted line-through" : "text-gray-200"}`}>
                {p.name}
              </span>
              {p.client && <span className="text-xs text-muted">{p.client.name}</span>}
              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleArchive(p)}
                  className="text-xs text-muted hover:text-gray-200 px-2"
                >
                  {p.archived ? "Réactiver" : "Archiver"}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-2"
                >
                  Supprimer
                </button>
              </div>
            </div>
            {expandedId === p.id && (
              <EditProjectPanel project={p} clients={clients} onUpdate={handleUpdate} />
            )}
          </div>
        ))}
        {projects.length === 0 && (
          <div className="text-center text-muted text-sm py-10">Aucun projet créé</div>
        )}
      </div>
    </div>
  );
}
