import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Client, Project } from "../api/types";
import ColorPicker, { PROJECT_COLORS } from "../components/ui/ColorPicker";
import ManagedRow from "../components/ui/ManagedRow";
import { CARD_CLASS, INLINE_INPUT_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "../components/ui/styles";

type ProjectPatch = Partial<Pick<Project, "name" | "color" | "clientId">>;

/** Inline edit panel (name, client, color) shown under an expanded project row. */
function EditProjectPanel({
  project,
  clients,
  onUpdate,
}: {
  project: Project;
  clients: Client[];
  onUpdate: (id: string, patch: ProjectPatch) => void;
}) {
  const [name, setName] = useState(project.name);

  function commitName() {
    if (name.trim() && name !== project.name) onUpdate(project.id, { name: name.trim() });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap px-4 pb-3 pt-1 bg-bg/40">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        placeholder="Nom du projet"
        className={`flex-1 min-w-[160px] ${INLINE_INPUT_CLASS}`}
      />
      <select
        value={project.clientId || ""}
        onChange={(e) => onUpdate(project.id, { clientId: e.target.value || null })}
        className={INLINE_INPUT_CLASS}
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

/** Projects page: create, edit (name / client / color), archive and delete projects. */
export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
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
    setColor(PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]);
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

  async function handleUpdate(id: string, patch: ProjectPatch) {
    const res = await api.put(`/projects/${id}`, patch);
    setProjects((prev) => prev.map((p) => (p.id === id ? res.data : p)));
  }

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-4">Projets</h1>

      <div className={`${CARD_CLASS} p-4 mb-6 flex items-end gap-3 flex-wrap`}>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-muted mb-1">Nom du projet</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du projet"
            className={`w-full ${INPUT_CLASS}`}
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={INPUT_CLASS}>
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
        <button onClick={handleCreate} className={`text-sm px-4 py-2 ${PRIMARY_BUTTON_CLASS}`}>
          + Ajouter
        </button>
      </div>

      <div className={CARD_CLASS}>
        {projects.map((p) => (
          <ManagedRow
            key={p.id}
            name={p.name}
            archived={p.archived}
            leading={<span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />}
            meta={p.client && <span className="text-xs text-muted">{p.client.name}</span>}
            expanded={expandedId === p.id}
            onToggleExpanded={() => setExpandedId(expandedId === p.id ? null : p.id)}
            onToggleArchive={() => toggleArchive(p)}
            onDelete={() => handleDelete(p.id)}
          >
            <EditProjectPanel project={p} clients={clients} onUpdate={handleUpdate} />
          </ManagedRow>
        ))}
        {projects.length === 0 && <div className="text-center text-muted text-sm py-10">Aucun projet créé</div>}
      </div>
    </div>
  );
}
