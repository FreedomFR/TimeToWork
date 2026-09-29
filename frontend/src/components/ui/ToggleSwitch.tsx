interface Props {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label: string;
  /** Renders the switch greyed-out and inert (used for not-yet-available options). */
  disabled?: boolean;
}

/** Labelled on/off switch (`role="switch"`). The whole label is clickable, and Space / Enter toggle it. */
export default function ToggleSwitch({ checked, onChange, label, disabled = false }: Props) {
  return (
    <label
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      className={`flex items-center gap-2 text-sm select-none rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        disabled ? "text-muted/50 cursor-not-allowed" : "text-muted cursor-pointer"
      }`}
      onClick={() => !disabled && onChange?.(!checked)}
      onKeyDown={(e) => {
        if (disabled || (e.key !== " " && e.key !== "Enter")) return;
        e.preventDefault();
        onChange?.(!checked);
      }}
    >
      <span className={`w-9 h-5 rounded-full relative transition-colors ${checked ? "bg-accent" : "bg-surfaceAlt"}`}>
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${
            disabled ? "bg-gray-500" : "bg-white"
          } ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
      {label}
    </label>
  );
}
