import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { apiErrorMessage } from "../utils/errors";
import AuthLayout, { BackToLoginLink } from "../components/ui/AuthLayout";
import TextField from "../components/ui/TextField";
import { PRIMARY_BUTTON_CLASS } from "../components/ui/styles";

/** Asks the backend to email a password-reset link. The answer never reveals whether the account exists. */
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
    } catch (err) {
      setError(apiErrorMessage(err, "Une erreur est survenue"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Entrez votre email, nous vous enverrons un lien pour en choisir un nouveau."
      footer={<BackToLoginLink />}
    >
      {message ? (
        <p className="text-sm text-gray-200 text-center bg-surfaceAlt rounded px-3 py-3">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField id="forgot-email" label="Email" type="email" required value={email} onChange={setEmail} />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" disabled={busy} className={`w-full py-2 text-sm disabled:opacity-60 ${PRIMARY_BUTTON_CLASS}`}>
            {busy ? "Envoi..." : "Envoyer le lien"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
