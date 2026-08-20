import { Icon } from "../Icon.jsx";
import { OverscrollRow } from "../OverscrollRow.jsx";

/**
 * Rangée d'onglets de sélection de liste (overscroll « stretch » horizontal) :
 * onglet agrégé « Toutes les courses » (dès 2 listes) puis une pastille par
 * liste, avec compteur coché/total, appui long / clic droit pour le menu, et
 * bouton ⋯ sur la pastille active. Présentationnel ; la sélection remonte au parent.
 */
export function ShoppingListTabs({ shoppingLists, hasAgg, allMode, effectiveId, aggregated, longPress, onSelectAll, onSelect, onOpenMenu }) {
  const { startLongPress, cancelLongPress, moveLongPress, wasLongPress } = longPress;
  return (
    <OverscrollRow stretch max={64} outerStyle={{ paddingBottom: 8 }} style={{ gap: 6, alignItems: "center" }}>
      {/* Onglet agrégé « Toutes les courses » (≥ 2 listes) */}
      {hasAgg && (() => {
        const aggChecked = aggregated.filter(a => a.checked).length;
        return (
          <button onClick={onSelectAll} className="slide-up ripple"
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 6, height: 34, boxSizing: "border-box", padding: "0 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              background: allMode ? "var(--accent)" : "var(--surface)",
              color: allMode ? "#fff" : "var(--accent)",
              border: `1px solid ${allMode ? "transparent" : "rgba(var(--accent-rgb),0.5)"}`
            }}>
            <Icon name="grid" size={12} color={allMode ? "#fff" : "var(--accent)"} />
            Toutes les courses
            {aggregated.length > 0 && (
              <span style={{ fontSize: 10, background: allMode ? "rgba(255,255,255,0.25)" : "rgba(var(--accent-rgb),0.14)", borderRadius: 10, padding: "1px 6px" }}>
                {aggChecked}/{aggregated.length}
              </span>
            )}
          </button>
        );
      })()}
      {shoppingLists.map((l, idx) => {
        const isActive = !allMode && effectiveId === l.id;
        const lChecked = l.items.filter(i => i.checked).length;
        return (
          <div key={l.id} role="button" tabIndex={0} className="slide-up ripple"
            onClick={() => { if (wasLongPress()) return; onSelect(l.id); }}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(l.id); } }}
            onPointerDown={e => startLongPress(e, () => onOpenMenu(l))} onPointerMove={moveLongPress} onPointerUp={cancelLongPress} onPointerLeave={cancelLongPress} onPointerCancel={cancelLongPress}
            onContextMenu={e => { e.preventDefault(); onOpenMenu(l); }}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 6, height: 34, boxSizing: "border-box", padding: isActive ? "0 6px 0 12px" : "0 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", userSelect: "none",
              background: isActive ? "var(--accent)" : "var(--surface)", animationDelay: `${idx * 0.05}s`,
              color: isActive ? "#fff" : "var(--text2)",
              border: `1px solid ${isActive ? "transparent" : "var(--border)"}`
            }}>
            <Icon name={l.type === "recipe" ? "book" : "shopping"} size={12} color={isActive ? "#fff" : "var(--text3)"} />
            {l.name}
            {l.items.length > 0 && (
              <span style={{ fontSize: 10, background: isActive ? "rgba(255,255,255,0.25)" : "var(--surface3)", borderRadius: 10, padding: "1px 6px" }}>
                {lChecked}/{l.items.length}
              </span>
            )}
            {/* Options : uniquement sur la liste active. La hauteur fixe de la
                pastille empêche le bouton (22px) de la faire grandir. */}
            {isActive && (
              <button onClick={e => { e.stopPropagation(); onOpenMenu(l); }} aria-label="Options de la liste"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: "none", background: "rgba(255,255,255,0.22)", cursor: "pointer", padding: 0 }}>
                <Icon name="ellipsis" size={14} color="#fff" />
              </button>
            )}
          </div>
        );
      })}
    </OverscrollRow>
  );
}
