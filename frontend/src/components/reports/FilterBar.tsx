import { Client, Project, Tag } from "../../api/types";
import { EntryFilters } from "../../utils/reportData";
import { CARD_CLASS } from "../ui/styles";
import MultiSelectFilter from "./MultiSelectFilter";
import DescriptionFilter from "./DescriptionFilter";
import { IconFilter } from "../icons";

interface Props {
  clients: Client[];
  projects: Project[];
  tags: Tag[];
  filters: EntryFilters;
  onChange: (filters: EntryFilters) => void;
}

/** Placeholder for a filter that exists in Clockify but isn't implemented here. */
function DisabledFilter({ label }: { label: string }) {
  return (
    <button disabled className="px-3 py-2 text-sm text-muted/60 cursor-not-allowed whitespace-nowrap">
      {label}
    </button>
  );
}

/**
 * Filter row shared by the report tabs. Filters apply immediately as they are
 * changed, so the "APPLIQUER LE FILTRE" button is purely visual (matching Clockify's layout).
 */
export default function FilterBar({ clients, projects, tags, filters, onChange }: Props) {
  return (
    <div className={`${CARD_CLASS} px-4 py-2 mb-4 flex items-center gap-1 flex-wrap`}>
      <span className="flex items-center gap-1.5 text-xs text-muted pr-2 border-r border-border mr-1">
        <IconFilter className="w-3.5 h-3.5" />
        FILTRER
      </span>
      <DisabledFilter label="Équipe" />
      <MultiSelectFilter
        label="Client"
        options={clients.map((c) => ({ id: c.id, label: c.name }))}
        value={filters.clientIds}
        onChange={(clientIds) => onChange({ ...filters, clientIds })}
      />
      <MultiSelectFilter
        label="Projet"
        options={projects.map((p) => ({ id: p.id, label: p.name, color: p.color }))}
        value={filters.projectIds}
        onChange={(projectIds) => onChange({ ...filters, projectIds })}
      />
      <DisabledFilter label="Tâche" />
      <MultiSelectFilter
        label="Balise"
        options={tags.map((t) => ({ id: t.id, label: t.name }))}
        value={filters.tagIds}
        onChange={(tagIds) => onChange({ ...filters, tagIds })}
      />
      <DescriptionFilter value={filters.description} onChange={(description) => onChange({ ...filters, description })} />
      <div className="ml-auto">
        <button
          onClick={() => {}}
          className="px-4 py-2 text-sm font-medium rounded bg-accent hover:bg-accentDark text-white whitespace-nowrap"
        >
          APPLIQUER LE FILTRE
        </button>
      </div>
    </div>
  );
}
