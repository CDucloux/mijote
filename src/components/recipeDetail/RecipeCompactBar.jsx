import { Icon } from "../Icon.jsx";

/**
 * Barre compacte sticky qui remplace le hero une fois replié (mobile). Fond, flou et
 * opacité du contenu sont écrits directement dans le DOM par `useHeroCollapse` via
 * `barRef` / `barInnerRef` ; ce composant ne porte que la structure et les actions.
 */
export function RecipeCompactBar({ barRef, barInnerRef, recipeName, publicMode, onBack, onOpenShopping }) {
  return (
    <div ref={barRef} style={{
      position: "sticky", top: 0, zIndex: 30, flexShrink: 0,
      // Hauteur et remontée majorées de la réserve d'inset : une fois repliée, la
      // barre recouvre AUSSI la zone système (fond plein), là où le hero peignait
      // son image. Le padding haut maintient le contenu (retour, titre, Courses) à
      // sa place d'origine, sous la barre système.
      height: "calc(52px + var(--safe-hero-top))", marginTop: "calc(-52px - var(--safe-hero-top))",
      display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--safe-hero-top) 14px 0",
      background: "rgba(var(--bg-rgb),0)", pointerEvents: "none",
      willChange: "background-color, backdrop-filter",
    }}>
      <div ref={barInnerRef} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
        opacity: 0, willChange: "opacity, transform",
      }}>
        <button onClick={onBack} className="tap" style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={16} color="var(--text)" /></button>
        <span style={{ fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 700, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "0 8px", color: "var(--text)" }}>{recipeName}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {!publicMode && <button onClick={onOpenShopping} className="tap" style={{ height: 32, padding: "0 12px", borderRadius: 20, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5, border: "none", cursor: "pointer" }}><Icon name="shopping" size={13} color="#fff" /> Courses</button>}
        </div>
      </div>
    </div>
  );
}
