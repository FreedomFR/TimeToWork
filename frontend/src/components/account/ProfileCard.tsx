import { useAuth } from "../../context/AuthContext";
import { ROLE_LABELS } from "../../utils/constants";
import { CARD_CLASS } from "../ui/styles";

/** Who is signed in: the initial in a circle (as in the menu), name, email and role. */
export default function ProfileCard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <section className={`${CARD_CLASS} p-6 flex items-center gap-5`} aria-label="Profil">
      <div
        aria-hidden
        className="w-16 h-16 shrink-0 rounded-full bg-accent flex items-center justify-center text-white text-2xl font-semibold"
      >
        {user.name?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold text-gray-100 truncate">{user.name}</p>
        <p className="text-sm text-gray-300 truncate">{user.email}</p>
      </div>
      <span
        className={`shrink-0 text-xs px-2.5 py-1 rounded-full ${
          user.role === "ADMIN" ? "bg-accent/15 text-accent" : "bg-surfaceAlt text-muted"
        }`}
      >
        {ROLE_LABELS[user.role]}
      </span>
    </section>
  );
}
