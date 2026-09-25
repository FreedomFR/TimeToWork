import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { AdminUser, Role } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { apiErrorMessage } from "../../utils/errors";
import { useDebounced } from "../../hooks/useDebounced";
import Modal from "../ui/Modal";
import { CARD_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "../ui/styles";

const ROLE_LABELS: Record<Role, string> = { ADMIN: "Administrateur", USER: "Utilisateur" };

/** A pending role change waiting for the admin's confirmation. */
interface Change {
  user: AdminUser;
  role: Role;
}

/**
 * Admin "Utilisateurs" tab: everyone with an account, searchable, with the buttons to give or
 * take away the admin role. Every change is confirmed first, and the server refuses to
 * demote the last admin.
 */
export default function UsersPanel() {
  const { user: me, refreshUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [change, setChange] = useState<Change | null>(null);
  const [busy, setBusy] = useState(false);
  const debouncedSearch = useDebounced(search);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin/users", { params: { search: debouncedSearch || undefined } });
      setUsers(res.data);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de charger les utilisateurs"));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmChange() {
    if (!change) return;
    setBusy(true);
    try {
      await api.put(`/admin/users/${change.user.id}/role`, { role: change.role });
      setChange(null);
      setError("");
      await load();
      // Changing your own role changes what you are allowed to see: refresh it right away
      if (change.user.id === me?.id) await refreshUser();
    } catch (err) {
      setChange(null);
      setError(apiErrorMessage(err, "Impossible de modifier le rôle"));
    } finally {
      setBusy(false);
    }
  }

  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <input
          type="search"
          aria-label="Rechercher un utilisateur"
          placeholder="Rechercher par nom ou email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`w-full sm:w-80 ${INPUT_CLASS}`}
        />
        <p className="text-sm text-muted">
          {users.length} utilisateur(s) · {adminCount} administrateur(s)
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400 bg-red-500/10 rounded px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className={`${CARD_CLASS} overflow-x-auto`}>
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-xs text-muted border-b border-border text-left">
              <th scope="col" className="font-normal px-4 py-3">NOM</th>
              <th scope="col" className="font-normal px-4 py-3">EMAIL</th>
              <th scope="col" className="font-normal px-4 py-3">RÔLE</th>
              <th scope="col" className="font-normal px-4 py-3 text-right">ENTRÉES</th>
              <th scope="col" className="font-normal px-4 py-3">INSCRIT LE</th>
              <th scope="col" className="font-normal px-4 py-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-testid="admin-user-row" className="border-b border-border last:border-b-0 hover:bg-surfaceAlt">
                <td className="px-4 py-3 text-gray-100">
                  {u.name}
                  {u.id === me?.id && <span className="ml-2 text-xs text-muted">(vous)</span>}
                </td>
                <td className="px-4 py-3 text-gray-300">{u.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      u.role === "ADMIN" ? "bg-accent/20 text-accent" : "bg-surfaceAlt text-gray-300"
                    }`}
                  >
                    {ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">{u.entryCount}</td>
                <td className="px-4 py-3 text-gray-300">{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
                <td className="px-4 py-3 text-right">
                  {u.role === "ADMIN" ? (
                    <button
                      onClick={() => setChange({ user: u, role: "USER" })}
                      className="text-xs text-red-400 hover:text-red-300 whitespace-nowrap"
                    >
                      Retirer le rôle admin
                    </button>
                  ) : (
                    <button
                      onClick={() => setChange({ user: u, role: "ADMIN" })}
                      className="text-xs text-accent hover:underline whitespace-nowrap"
                    >
                      Promouvoir administrateur
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && <p className="text-center text-muted text-sm py-10">Aucun utilisateur trouvé</p>}
      </div>

      {change && (
        <Modal
          title={change.role === "ADMIN" ? "Promouvoir administrateur" : "Retirer le rôle administrateur"}
          onClose={() => setChange(null)}
          footer={
            <>
              <button onClick={() => setChange(null)} className="px-4 py-2 text-sm rounded text-gray-300 hover:bg-surfaceAlt">
                Annuler
              </button>
              <button
                onClick={confirmChange}
                disabled={busy}
                className={`px-4 py-2 text-sm disabled:opacity-60 ${
                  change.role === "ADMIN" ? PRIMARY_BUTTON_CLASS : "bg-red-500 hover:bg-red-600 text-white font-medium rounded"
                }`}
              >
                Confirmer
              </button>
            </>
          }
        >
          <p className="text-sm text-gray-200">
            {change.role === "ADMIN" ? (
              <>
                <strong>{change.user.name}</strong> ({change.user.email}) pourra consulter le journal et gérer les rôles de
                tous les comptes.
              </>
            ) : (
              <>
                <strong>{change.user.name}</strong> ({change.user.email}) n'aura plus accès à l'administration.
                {change.user.id === me?.id && " Vous perdrez l'accès à cette page."}
              </>
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}
