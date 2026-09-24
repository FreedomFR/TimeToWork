import { InputHTMLAttributes } from "react";
import { INPUT_CLASS } from "./styles";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  onChange: (value: string) => void;
}

/** Labelled full-width text input for the auth forms. `id` links the label to the input. */
export default function TextField({ label, onChange, ...inputProps }: Props) {
  return (
    <div>
      <label htmlFor={inputProps.id} className="block text-sm text-muted mb-1">
        {label}
      </label>
      <input {...inputProps} onChange={(e) => onChange(e.target.value)} className={`w-full ${INPUT_CLASS}`} />
    </div>
  );
}
