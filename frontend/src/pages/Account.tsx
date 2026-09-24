import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../utils/errors";
import TextField from "../components/ui/TextField";
import { CARD_CLASS, PRIMARY_BUTTON_CLASS } from "../components/ui/styles";

/** "Mon compte": shows the signed-in user and lets them change their password. */
export default function Account() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de modifier le mot de passe"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold text-gray-100 mb-4">Mon compte</h1>

      <div className={`${CARD_CLASS} p-6 mb-6 max-w-xl`}>
        <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Nom</dt>
          <dd className="text-gray-200">{user?.name}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="text-gray-200">{user?.email}</dd>
        </dl>
      </div>

      <form onSubmit={handleSubmit} className={`${CARD_CLASS} p-6 max-w-xl space-y-4`}>
        <h2 className="text-base font-semibold text-gray-100">Changer le mot de passe</h2>

        <TextField
          id="current-password"
          label="Mot de passe actuel"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={setCurrentPassword}
        />
        <TextField
          id="new-password"
          label="Nouveau mot de passe"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={newPassword}
          onChange={setNewPassword}
        />
        <TextField
          id="confirm-new-password"
          label="Confirmer le nouveau mot de passe"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-green-400">Mot de passe mis à jour.</p>}

        <button type="submit" disabled={busy} className={`px-5 py-2 text-sm disabled:opacity-60 ${PRIMARY_BUTTON_CLASS}`}>
          {busy ? "Mise à jour..." : "Mettre à jour le mot de passe"}
        </button>
      </form>
    </div>
  );
}
