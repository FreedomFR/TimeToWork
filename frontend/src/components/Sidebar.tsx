import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const baseLinks = [
  { to: "/", label: "Suivi du temps", icon: "⏱" },
  { to: "/calendar", label: "Calendrier", icon: "🗓" },
  { to: "/dashboard", label: "Tableau de bord", icon: "🏠" },
  { to: "/reports", label: "Rapports", icon: "📊" },
  { to: "/projects", label: "Projets", icon: "📁" },
  { to: "/clients", label: "Clients", icon: "👤" },
  { to: "/account", label: "Mon compte", icon: "⚙️" },
];

/** Shown only to administrators (the page itself is also protected by the server). */
const adminLink = { to: "/admin", label: "Administration", icon: "🛡" };

/** Left navigation with the user's name and the logout button. */
export default function Sidebar() {
  const { user, logout } = useAuth();
  const links = user?.role === "ADMIN" ? [...baseLinks, adminLink] : baseLinks;

  return (
    <aside className="w-60 shrink-0 bg-sidebar text-gray-200 flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
        <div className="w-8 h-8 rounded bg-accent flex items-center justify-center font-bold text-white">
          T
        </div>
        <span className="font-semibold text-white text-lg">TimeToWork</span>
      </div>

      <nav className="flex-1 py-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm mx-2 rounded transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : "text-gray-300 hover:bg-sidebarHover hover:text-white"
              }`
            }
          >
            <span>{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-semibold">
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full text-sm text-gray-300 hover:text-white border border-white/10 rounded py-1.5 hover:bg-sidebarHover transition-colors"
        >
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
