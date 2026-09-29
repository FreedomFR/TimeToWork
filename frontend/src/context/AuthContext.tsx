import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";
import { Preferences, User } from "../api/types";
import { applyAppearance, resetAppearance } from "../utils/appearance";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  devLogin: (userId: string) => Promise<void>;
  logout: () => void;
  /** Re-reads the user from the server (e.g. after their role changed). */
  refreshUser: () => Promise<void>;
  /** Saves display settings (only the given ones change). Applied at once; put back if the server refuses. */
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Holds the signed-in user. The JWT lives in localStorage; on load it is exchanged
 * for the user via `/auth/me`, and an invalid token is dropped.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  // The user's display settings follow the user: applied on sign-in, dropped on sign-out.
  // (While loading, the settings cached by the browser stay in place: no flash on reload.)
  useEffect(() => {
    if (loading) return;
    if (user) applyAppearance(user.preferences);
    else resetAppearance();
  }, [user?.preferences, loading]);

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
  }

  async function register(email: string, password: string, name: string) {
    const res = await api.post("/auth/register", { email, password, name });
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
  }

  async function devLogin(userId: string) {
    const res = await api.post("/auth/dev/login", { userId });
    localStorage.setItem("token", res.data.token);
    setUser(res.data.user);
  }

  async function refreshUser() {
    const res = await api.get("/auth/me");
    setUser(res.data);
  }

  async function updatePreferences(patch: Partial<Preferences>) {
    if (!user) return;
    const before = user.preferences;
    setUser((u) => (u ? { ...u, preferences: { ...u.preferences, ...patch } } : u));
    try {
      const res = await api.put("/auth/preferences", patch);
      setUser((u) => (u ? { ...u, preferences: res.data } : u));
    } catch (err) {
      setUser((u) => (u ? { ...u, preferences: before } : u));
      throw err;
    }
  }

  function logout() {
    // Tell the server so the sign-out shows up in the admin journal. Best effort: the token is
    // sent explicitly because it is removed right below, and a failure must not block signing out.
    const token = localStorage.getItem("token");
    if (token) {
      api.post("/auth/logout", null, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, devLogin, logout, refreshUser, updatePreferences }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
