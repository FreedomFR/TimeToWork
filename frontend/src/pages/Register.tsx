import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(email, password, name);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Échec de l'inscription");
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

        <h1 className="text-lg font-semibold text-center mb-6 text-gray-100">Créer un compte</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="register-name" className="block text-sm text-muted mb-1">
              Nom
            </label>
            <input
              id="register-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="register-email" className="block text-sm text-muted mb-1">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="register-password" className="block text-sm text-muted mb-1">
              Mot de passe
            </label>
            <input
              id="register-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent hover:bg-accentDark text-white rounded py-2 text-sm font-medium transition-colors disabled:opacity-60"
          >
            {busy ? "Création..." : "Créer le compte"}
          </button>
        </form>

        <p className="text-sm text-muted text-center mt-5">
          Déjà un compte ?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
