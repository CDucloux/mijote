import type { CSSProperties, ReactNode } from "react";

// Langage « ticket » des feuilles explicatives (difficulté, préparation de base) :
// pas de cartes, l'alignement et la typo font la structure.

/** Intertitre de section d'une feuille explicative. */
export function LedgerHeading({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text2)", margin: "0 0 4px", ...style }}>{children}</div>;
}

interface LedgerRowProps {
  title: ReactNode;
  hint?: ReactNode;
  /** Valeur alignée à droite (absente pour une ligne purement descriptive). */
  value?: ReactNode;
  muted?: boolean;
}

/** Ligne du ticket : intitulé + précision à gauche, valeur éventuelle alignée à droite. */
export function LedgerRow({ title, hint, value, muted = false }: LedgerRowProps) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "11px 0" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: muted ? "var(--text3)" : "var(--text)", lineHeight: 1.35 }}>{title}</div>
        {hint && <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      {value != null && <div style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: muted ? "var(--text3)" : "var(--text)" }}>{value}</div>}
    </div>
  );
}
