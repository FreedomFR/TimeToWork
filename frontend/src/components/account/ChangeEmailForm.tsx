import { FormEvent, useState } from "react";
import { api } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { apiErrorMessage } from "../../utils/errors";
import TextField from "../ui/TextField";
import { CARD_CLASS, PRIMARY_BUTTON_CLASS } from "../ui/styles";

/**
 * "Changer l'adresse email". The new address is typed twice (a typo would lock the user out of
 * "forgot password") and the current password is required, since whoever controls the email
 * controls the account. The old address is warned by email.
 */
export default function ChangeEmailForm() {
  const { user, refreshUser } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [changedTo, setChangedTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setChangedTo("");

    const wanted = newEmail.trim();
    if (wanted !== confirmEmail.trim()) {
      setError("Les adresses email ne correspondent pas");
      return;
    }
    if (wanted.toLowerCase() === user?.email.toLowerCase()) {
      setError("Le nouvel email est identique à l'actuel");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/change-email", { currentPassword: password, newEmail: wanted });
      await refreshUser(); // the sidebar and the profile show the new address right away
      setChangedTo(wanted);
      setNewEmail("");
      setConfirmEmail("");
      setPassword("");
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de modifier l'email"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${CARD_CLASS} p-6 space-y-4`}>
      <h2 className="text-base font-semibold text-gray-100">Changer l'adresse email</h2>
      <p className="text-xs text-muted">
        Vous vous connecterez avec la nouvelle adresse, et l'ancienne en sera informée par email.
      </p>

      <TextField
        id="new-email"
        label="Nouvel email"
        type="email"
        required
        autoComplete="email"
        value={newEmail}
        onChange={setNewEmail}
      />
      <TextField
        id="confirm-new-email"
        label="Confirmer le nouvel email"
        type="email"
        required
        autoComplete="off"
        value={confirmEmail}
        onChange={setConfirmEmail}
      />
      <TextField
        id="email-current-password"
        label="Mot de passe actuel"
        type="password"
        required
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
      />

      {error && <p className="text-sm text-red-400">{error}</p>}
      {changedTo && (
        <p className="text-sm text-green-400">
          Email mis à jour : vous vous connecterez désormais avec {changedTo}.
        </p>
      )}

      <button type="submit" disabled={busy} className={`px-5 py-2 text-sm disabled:opacity-60 ${PRIMARY_BUTTON_CLASS}`}>
        {busy ? "Mise à jour..." : "Mettre à jour l'email"}
      </button>
    </form>
  );
}
