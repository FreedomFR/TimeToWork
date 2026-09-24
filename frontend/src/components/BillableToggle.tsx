import { IconDollar } from "./icons";

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function BillableToggle({ value, onChange }: Props) {
  return (
    <button
      type="button"
      title="Facturable"
      onClick={() => onChange(!value)}
      className={`w-9 h-9 shrink-0 rounded flex items-center justify-center transition-colors ${
        value ? "text-accent bg-surfaceAlt" : "text-muted hover:text-gray-300 hover:bg-surfaceAlt"
      }`}
    >
      <IconDollar />
    </button>
  );
}
