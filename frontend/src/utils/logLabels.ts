import { LogLevel, LogType } from "../api/types";

/** Human labels of the journal's event types ("types of bug"), in the order shown in filters. */
export const LOG_TYPE_LABELS: Record<LogType, string> = {
  server_error: "Erreur serveur",
  client_error: "Erreur navigateur",
  auth_failed: "Échec d'authentification",
  rate_limited: "Limite atteinte",
  forbidden: "Accès refusé",
  validation_error: "Données invalides",
  admin_action: "Action d'administration",
};

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  error: "Erreur",
  warn: "Avertissement",
  info: "Info",
};

/** Badge colors per level (Tailwind classes). */
export const LOG_LEVEL_STYLES: Record<LogLevel, string> = {
  error: "bg-red-500/15 text-red-300",
  warn: "bg-amber-500/15 text-amber-300",
  info: "bg-surfaceAlt text-gray-300",
};
