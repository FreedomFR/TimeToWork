import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

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
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || "Lien invalide ou expiré");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow p-8">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-9 h-9 rounded bg-accent flex items-center justify-center font-bold text-white">
            T
          </div>
          <span className="font-semibold text-xl text-gray-100">TimeToWork</span>
        </div>

        <h1 className="text-lg font-semibold text-center mb-6 text-gray-100">
          Nouveau mot de passe
        </h1>

        {!token ? (
          <p className="text-sm text-red-400 text-center">Lien de réinitialisation invalide.</p>
        ) : done ? (
          <p className="text-sm text-gray-200 text-center bg-surfaceAlt rounded px-3 py-3">
            Mot de passe mis à jour. Redirection vers la connexion...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Nouveau mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-muted mb-1">Confirmer le mot de passe</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-accent hover:bg-accentDark text-white rounded py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {busy ? "Mise à jour..." : "Réinitialiser le mot de passe"}
            </button>
          </form>
        )}

        <p className="text-sm text-muted text-center mt-5">
          <Link to="/login" className="text-accent hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
