import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Keeps non-admins out of a page: they are sent back to the time tracker. This only hides the
 * screen — the real protection is the server, which answers 403 to admin routes for anyone else.
 */
export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return <>{children}</>;
}
