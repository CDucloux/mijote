import type { ReactNode } from "react";
import { StickySheetHeader } from "./StickySheetHeader.jsx";

interface SheetIdentityHeaderProps {
  /** Contenu de la tuile de 52px (icône, photo). */
  media: ReactNode;
  /** Fond de la tuile. */
  mediaBackground: string;
  title: string;
  /** Puce colorée sous le titre (catégorie). */
  chip: string;
  chipColor: string;
  /** Complément à droite de la puce (pastilles de difficulté, appareil…). */
  extra?: ReactNode;
}

// En-tête collant des feuilles d'édition de la console (geste, ustensile) :
// tuile, titre et puce de catégorie, pour que la saisie reflète la fiche affichée.
export function SheetIdentityHeader({ media, mediaBackground, title, chip, chipColor, extra }: SheetIdentityHeaderProps) {
  return (
    <StickySheetHeader>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <span style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, overflow: "hidden", display: "grid", placeItems: "center", background: mediaBackground }}>
          {media}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.1, color: "var(--text)" }}>{title}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: chipColor, background: `color-mix(in srgb, ${chipColor} 14%, transparent)`, padding: "3px 9px", borderRadius: 999 }}>{chip}</span>
            {extra}
          </div>
        </div>
      </div>
    </StickySheetHeader>
  );
}
