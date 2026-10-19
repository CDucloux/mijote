import { Icon } from "../ui/Icon.jsx";
import { BaseIcon } from "../ui/BaseIcon.jsx";
import { fmtElapsed } from "@/lib/format.js";

interface CookModeHeaderProps {
  recipeName: string | undefined;
  /** Pas à pas d'une préparation de base, ouvert depuis la recette principale. */
  isNested: boolean;
  /** Libellé de la page courante (« Mise en place », « Étape 2 / 5 »…). */
  pageLabel: string;
  /** Secondes écoulées depuis le lancement (chrono masqué en imbriqué). */
  elapsed: number;
  progress: number;
  onClose: () => void;
}

/** En-tête du pas à pas : fermeture, titre, page courante, chrono global et progression. */
export function CookModeHeader({ recipeName, isNested, pageLabel, elapsed, progress, onClose }: CookModeHeaderProps) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "calc(16px + max(env(safe-area-inset-top) - 8px, 0px)) 20px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <button className="cook-close-btn" onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={isNested ? "back" : "close"} size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isNested && <span style={{ display: "inline-flex", alignItems: "center", marginRight: 6 }}><BaseIcon size={14} /></span>}
            {recipeName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>{pageLabel}</div>
        </div>
        {/* Chrono global : temps écoulé depuis le lancement de la recette. */}
        {!isNested && (
          <div title="Temps écoulé depuis le lancement" style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "6px 11px", borderRadius: 999, background: "var(--surface2)", border: "1px solid var(--border)", fontVariantNumeric: "tabular-nums" }}>
            <Icon name="clock" size={14} color="var(--accent)" />
            <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "0.02em", color: "var(--text)" }}>{fmtElapsed(elapsed)}</span>
          </div>
        )}
      </div>

      <div style={{ height: 3, background: "var(--surface2)", flexShrink: 0 }}>
        <div style={{ height: "100%", background: "var(--accent)", width: `${progress}%`, transition: "width 0.4s ease" }} />
      </div>
    </>
  );
}
