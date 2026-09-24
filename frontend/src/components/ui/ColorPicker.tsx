/** Palette offered when creating or editing a project. */
export const PROJECT_COLORS = [
  "#03A9F4", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5",
  "#009688", "#4CAF50", "#FF9800", "#795548", "#607D8B",
];

interface Props {
  value: string;
  onChange: (color: string) => void;
}

/** Row of color swatches; the selected one gets a ring. */
export default function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex gap-1 flex-wrap">
      {PROJECT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-6 h-6 rounded-full shrink-0 ${
            value === c ? "ring-2 ring-offset-2 ring-offset-surface ring-gray-400" : ""
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}
