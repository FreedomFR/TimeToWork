import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiErrorMessage } from "../utils/errors";
import AuthLayout from "../components/ui/AuthLayout";
import TextField from "../components/ui/TextField";
import { PRIMARY_BUTTON_CLASS } from "../components/ui/styles";

/** Account creation; logs the new user in on success. */
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
    } catch (err) {
      setError(apiErrorMessage(err, "Échec de l'inscription"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Créer un compte"
      footer={
        <>
          Déjà un compte ?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField id="register-name" label="Nom" required value={name} onChange={setName} />
        <TextField id="register-email" label="Email" type="email" required value={email} onChange={setEmail} />
        <TextField
          id="register-password"
          label="Mot de passe"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={setPassword}
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={busy} className={`w-full py-2 text-sm disabled:opacity-60 ${PRIMARY_BUTTON_CLASS}`}>
          {busy ? "Création..." : "Créer le compte"}
        </button>
      </form>
    </AuthLayout>
  );
}
