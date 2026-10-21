import type { ReactNode } from "react";

interface NotebookCoverProps {
  color: string;
  icon: string;
  /** Écart entre deux lignes de la page (px). */
  lineGap?: number;
  /** Largeur de la reliure (px). */
  spine?: number;
  iconSize?: number;
  /** Habillage posé sur la page (pastille compteur…). */
  children?: ReactNode;
}

/**
 * Page de couverture d'un carnet : papier ligné teinté, reliure colorée à trois
 * anneaux et picto centré. Partagée par la carte de la bibliothèque et l'aperçu
 * en direct de l'éditeur.
 */
export function NotebookCover({ color, icon, lineGap = 27, spine = 11, iconSize = 34, children }: NotebookCoverProps) {
  return (
    <div style={{ position: "relative", aspectRatio: "1/1", background: `linear-gradient(180deg, ${color}1f 0%, ${color}12 100%)`, backgroundImage: `repeating-linear-gradient(${color}00 0 ${lineGap}px, ${color}22 ${lineGap}px ${lineGap + 1}px)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: spine, background: `linear-gradient(180deg, ${color} 0%, ${color}cc 100%)` }} />
      <div style={{ position: "absolute", left: spine * 0.27, top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 3 }}>
        {[0, 1, 2].map(d => <span key={d} style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.85)" }} />)}
      </div>
      {children}
      <span className="notebook-card-icon" style={{ fontSize: iconSize, lineHeight: 1, filter: "drop-shadow(0 3px 5px rgba(0,0,0,0.18))" }}>{icon}</span>
    </div>
  );
}
