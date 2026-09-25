import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { apiErrorMessage } from "../utils/errors";
import AuthLayout, { BackToLoginLink } from "../components/ui/AuthLayout";
import TextField from "../components/ui/TextField";
import { PRIMARY_BUTTON_CLASS } from "../components/ui/styles";

const REDIRECT_DELAY_MS = 2000;

/** Landing page of the emailed link (`/reset-password?token=…`): lets the user choose a new password. */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), REDIRECT_DELAY_MS);
    } catch (err) {
      setError(apiErrorMessage(err, "Lien invalide ou expiré"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Nouveau mot de passe" footer={<BackToLoginLink />}>
      {!token ? (
        <p className="text-sm text-red-400 text-center">Lien de réinitialisation invalide.</p>
      ) : done ? (
        <p className="text-sm text-gray-200 text-center bg-surfaceAlt rounded px-3 py-3">
          Mot de passe mis à jour. Redirection vers la connexion...
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            id="reset-password"
            label="Nouveau mot de passe"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={setPassword}
          />
          <TextField
            id="reset-password-confirm"
            label="Confirmer le mot de passe"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={busy} className={`w-full py-2 text-sm disabled:opacity-60 ${PRIMARY_BUTTON_CLASS}`}>
            {busy ? "Mise à jour..." : "Réinitialiser le mot de passe"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
