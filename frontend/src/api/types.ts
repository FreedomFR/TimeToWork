/** Shapes of the JSON returned by the backend API. */
export type Role = "USER" | "ADMIN";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Client {
  id: string;
  name: string;
  archived: boolean;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  clientId: string | null;
  client: Client | null;
}

export interface Tag {
  id: string;
  name: string;
}

export interface TimeEntry {
  id: string;
  description: string;
  start: string;
  end: string | null;
  billable: boolean;
  projectId: string | null;
  project: Project | null;
  tags: Tag[];
}

export interface ReportSummary {
  totalSeconds: number;
  byProject: {
    projectId: string | null;
    name: string;
    color: string;
    seconds: number;
  }[];
}

/** Payload to create an already-finished entry (manual mode of the time tracker). */
export interface NewEntryPayload {
  description: string;
  projectId: string | null;
  tagIds: string[];
  billable: boolean;
  /** ISO strings */
  start: string;
  end: string;
}

/** Fields of an entry that can be edited in place (all optional: only sent fields change). */
export type EntryPatch = Partial<{
  description: string;
  projectId: string | null;
  tagIds: string[];
  billable: boolean;
  start: string;
  end: string;
}>;

/** A user as listed on the admin page. */
export interface AdminUser extends User {
  createdAt: string;
  /** Number of time entries the account has. */
  entryCount: number;
}

export type LogType =
  | "server_error"
  | "client_error"
  | "auth_failed"
  | "rate_limited"
  | "forbidden"
  | "validation_error"
  | "admin_action";

export type LogLevel = "info" | "warn" | "error";

/** One line of the application journal (admin page). */
export interface LogEntry {
  id: string;
  createdAt: string;
  level: LogLevel;
  type: LogType;
  message: string;
  method: string | null;
  path: string | null;
  statusCode: number | null;
  /** Stack trace or small JSON, as text. */
  details: string | null;
  userEmail: string | null;
  /** null when the entry has no account, or the account was deleted. */
  user: { id: string; name: string; email: string } | null;
}

export interface LogPage {
  items: LogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LogSummary {
  types: LogType[];
  levels: LogLevel[];
  byType: Partial<Record<LogType, number>>;
  byLevel: Partial<Record<LogLevel, number>>;
}
