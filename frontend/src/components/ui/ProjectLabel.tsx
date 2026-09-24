import { Project } from "../../api/types";

interface Props {
  project: Project;
  /** Text size / spacing classes, e.g. "text-sm" or "text-xs". */
  className?: string;
  showClient?: boolean;
}

/** Colored dot + project name (+ " - client"), tinted with the project's color. */
export default function ProjectLabel({ project, className = "text-sm", showClient = true }: Props) {
  return (
    <span className={`flex items-center gap-1.5 shrink-0 ${className}`} style={{ color: project.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: project.color }} />
      {project.name}
      {showClient && project.client && ` - ${project.client.name}`}
    </span>
  );
}
