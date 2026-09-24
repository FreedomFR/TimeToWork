import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { User } from "../api/types";

export default function Login() {
  const { login, devLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [devUsers, setDevUsers] = useState<User[] | null>(null);
  const [devBusy, setDevBusy] = useState<string | null>(null);

  useEffect(() => {
    api
      .get("/auth/dev/users")
      .then((res) => setDevUsers(res.data))
      .catch(() => setDevUsers(null));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Échec de la connexion");
    } finally {
      setBusy(false);
    }
  }

  async function handleDevLogin(userId: string) {
    setError("");
    setDevBusy(userId);
    try {
      await devLogin(userId);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.error || "Échec de la connexion");
    } finally {
      setDevBusy(null);
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

        <h1 className="text-lg font-semibold text-center mb-6 text-gray-100">Connexion</h1>

        {devUsers && devUsers.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5">
                DEV
              </span>
              <span className="text-xs text-muted">Connexion rapide sans mot de passe</span>
            </div>
            <div className="space-y-1.5">
              {devUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleDevLogin(u.id)}
                  disabled={devBusy !== null}
                  className="w-full flex items-center gap-3 bg-surfaceAlt hover:bg-sidebarHover rounded px-3 py-2 text-left transition-colors disabled:opacity-60"
                >
                  <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
                    {u.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 truncate">{u.name}</p>
                    <p className="text-xs text-muted truncate">{u.email}</p>
                  </div>
                  {devBusy === u.id && (
                    <span className="ml-auto text-xs text-muted">Connexion...</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted">ou</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm text-muted mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surfaceAlt border-none rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="login-password" className="block text-sm text-muted">
                Mot de passe
              </label>
              <Link to="/forgot-password" className="text-xs text-accent hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              required
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
            {busy ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <p className="text-sm text-muted text-center mt-5">
          Pas de compte ?{" "}
          <Link to="/register" className="text-accent hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
