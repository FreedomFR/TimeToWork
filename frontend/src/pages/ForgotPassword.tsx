import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/auth/forgot-password", { email });
      setMessage(res.data.message);
    } catch (err: any) {
      setError(err.response?.data?.error || "Une erreur est survenue");
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

        <h1 className="text-lg font-semibold text-center mb-2 text-gray-100">
          Mot de passe oublié
        </h1>
        <p className="text-sm text-muted text-center mb-6">
          Entrez votre email, nous vous enverrons un lien pour en choisir un nouveau.
        </p>

        {message ? (
          <p className="text-sm text-gray-200 text-center bg-surfaceAlt rounded px-3 py-3">
            {message}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-accent hover:bg-accentDark text-white rounded py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {busy ? "Envoi..." : "Envoyer le lien"}
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
