import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Line shown under the form, e.g. "Pas de compte ? Créer un compte". */
  footer?: ReactNode;
}

/** Centered card with the TimeToWork logo, shared by the login / register / password-reset pages. */
export default function AuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow p-8">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-9 h-9 rounded bg-accent flex items-center justify-center font-bold text-white">T</div>
          <span className="font-semibold text-xl text-gray-100">TimeToWork</span>
        </div>

        <h1 className={`text-lg font-semibold text-center text-gray-100 ${subtitle ? "mb-2" : "mb-6"}`}>{title}</h1>
        {subtitle && <p className="text-sm text-muted text-center mb-6">{subtitle}</p>}

        {children}

        {footer && <p className="text-sm text-muted text-center mt-5">{footer}</p>}
      </div>
    </div>
  );
}

/** Standard "back to login" footer link. */
export function BackToLoginLink() {
  return (
    <Link to="/login" className="text-accent hover:underline">
      Retour à la connexion
    </Link>
  );
}
