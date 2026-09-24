import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";
import { User } from "../api/types";
import { apiErrorMessage } from "../utils/errors";
import AuthLayout from "../components/ui/AuthLayout";
import TextField from "../components/ui/TextField";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "../components/ui/styles";

/**
 * Login page. When the backend runs with DEV_MODE=true it also lists every
 * account for one-click, passwordless sign-in (the endpoint answers 404 otherwise).
 */
export default function Login() {
  const { login, devLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // null = dev mode off (or unreachable): the quick-login list stays hidden
  const [devUsers, setDevUsers] = useState<User[] | null>(null);
  const [devBusyId, setDevBusyId] = useState<string | null>(null);

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
    } catch (err) {
      setError(apiErrorMessage(err, "Échec de la connexion"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDevLogin(userId: string) {
    setError("");
    setDevBusyId(userId);
    try {
      await devLogin(userId);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err, "Échec de la connexion"));
    } finally {
      setDevBusyId(null);
    }
  }

  return (
    <AuthLayout
      title="Connexion"
      footer={
        <>
          Pas de compte ?{" "}
          <Link to="/register" className="text-accent hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      {devUsers && devUsers.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 rounded px-1.5 py-0.5">DEV</span>
            <span className="text-xs text-muted">Connexion rapide sans mot de passe</span>
          </div>
          <div className="space-y-1.5">
            {devUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleDevLogin(u.id)}
                disabled={devBusyId !== null}
                className="w-full flex items-center gap-3 bg-surfaceAlt hover:bg-sidebarHover rounded px-3 py-2 text-left transition-colors disabled:opacity-60"
              >
                <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
                  {u.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{u.name}</p>
                  <p className="text-xs text-muted truncate">{u.email}</p>
                </div>
                {devBusyId === u.id && <span className="ml-auto text-xs text-muted">Connexion...</span>}
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
        <TextField id="login-email" label="Email" type="email" required value={email} onChange={setEmail} />

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
            className={`w-full ${INPUT_CLASS}`}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={busy} className={`w-full py-2 text-sm disabled:opacity-60 ${PRIMARY_BUTTON_CLASS}`}>
          {busy ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </AuthLayout>
  );
}
