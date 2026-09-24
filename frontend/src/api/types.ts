/** Shapes of the JSON returned by the backend API. */
export interface User {
  id: string;
  email: string;
  name: string;
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
