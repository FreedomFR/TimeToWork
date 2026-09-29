import { useEffect, useRef, useState } from "react";
import { TextSize } from "../../api/types";
import { useAuth } from "../../context/AuthContext";
import { TEXT_SIZES, systemReducesMotion } from "../../utils/appearance";
import { apiErrorMessage } from "../../utils/errors";
import ToggleSwitch from "../ui/ToggleSwitch";
import { CARD_CLASS } from "../ui/styles";

/**
 * "Apparence": animations on/off and text size. There is no save button: each choice applies at once
 * and is saved on the account, so it follows the user to any browser they sign in from.
 */
export default function AppearanceForm() {
  const { user, updatePreferences } = useAuth();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  if (!user) return null;
  const { animations, textSize } = user.preferences;

  async function save(patch: { animations?: boolean; textSize?: TextSize }) {
    setError("");
    setSaved(false);
    try {
      await updatePreferences(patch);
      setSaved(true);
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible d'enregistrer ce réglage"));
    }
  }

  return (
    <section className={`${CARD_CLASS} p-6`} aria-labelledby="appearance-title">
      <div className="flex items-center justify-between mb-1">
        <h2 id="appearance-title" className="text-base font-semibold text-gray-100">
          Apparence
        </h2>
        <span role="status" className="text-xs text-green-400">
          {saved ? "Réglage enregistré" : ""}
        </span>
      </div>
      <p className="text-sm text-muted mb-4">Ces réglages sont liés à votre compte : vous les retrouvez sur tous vos appareils.</p>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <ToggleSwitch checked={animations} onChange={(value) => save({ animations: value })} label="Animations" />
          <p className="text-xs text-muted mt-1.5">
            Fondus, fenêtres et menus qui apparaissent en douceur, graphiques qui se dessinent, chrono qui pulse.
            Désactivées, tout s'affiche instantanément.
          </p>
          {systemReducesMotion() && (
            <p className="text-xs text-amber-300 mt-1.5">
              Votre système demande de réduire les animations : elles restent désactivées, quel que soit ce réglage.
            </p>
          )}
        </div>

        <div role="radiogroup" aria-label="Taille du texte">
          <p className="text-sm text-gray-200 mb-2">Taille du texte</p>
          <div className="inline-flex rounded overflow-hidden border border-border">
            {TEXT_SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                role="radio"
                aria-checked={textSize === size.value}
                onClick={() => textSize !== size.value && save({ textSize: size.value })}
                className={`px-4 py-2 text-sm border-r border-border last:border-r-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                  textSize === size.value ? "bg-accent text-white" : "bg-surfaceAlt text-gray-300 hover:bg-sidebarHover"
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400 mt-4">
          {error}
        </p>
      )}
    </section>
  );
}
