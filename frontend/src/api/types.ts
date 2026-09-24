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
