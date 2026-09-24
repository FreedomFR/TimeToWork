import { ReactNode } from "react";
import { CARD_CLASS } from "./styles";

/** Centered message in a card ("Chargement...", "Cette vue n'est pas encore disponible."…). */
export default function MessageCard({ children }: { children: ReactNode }) {
  return <div className={`${CARD_CLASS} p-12 text-center text-muted text-sm`}>{children}</div>;
}
