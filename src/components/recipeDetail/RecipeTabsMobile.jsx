import { TAB_ORDER } from "../../hooks/useHeroCollapse.js";

/**
 * Sélecteur d'onglets sticky (mobile) : contrôle segmenté avec pastille glissante entre
 * Ingrédients / Ustensiles / Étapes. Présentationnel ; l'onglet actif est piloté au-dessus.
 */
export function RecipeTabsMobile({ activeTab, setActiveTab }) {
  return (
    <div style={{ position: "sticky", top: 52, zIndex: 29, background: "var(--bg)", padding: "8px 16px 10px", flexShrink: 0 }}>
      <div style={{ position: "relative", display: "flex", background: "var(--surface2)", borderRadius: 12, padding: 4 }}>
        {/* Pastille active qui glisse d'un segment à l'autre */}
        <div aria-hidden="true" style={{
          position: "absolute", top: 4, bottom: 4, left: 4,
          width: `calc((100% - 8px) / ${TAB_ORDER.length})`,
          background: "var(--surface)", borderRadius: 9, boxShadow: "0 1px 3px rgba(0,0,0,0.14)",
          transform: `translateX(${TAB_ORDER.indexOf(activeTab) * 100}%)`,
          transition: "transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
        }} />
        {TAB_ORDER.map(t => {
          const on = activeTab === t;
          return (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              position: "relative", zIndex: 1, flex: 1, padding: "11px 0", fontSize: 13, fontWeight: 600,
              border: "none", background: "none", cursor: "pointer",
              color: on ? "var(--accent)" : "var(--text3)", transition: "color 0.2s ease",
            }}>{t}</button>
          );
        })}
      </div>
    </div>
  );
}
