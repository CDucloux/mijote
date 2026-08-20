import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";

/**
 * Feuille de rangement d'une recette dans un ou plusieurs carnets (collections). Chaque
 * carnet actif est mis en avant par sa couleur ; le basculement passe par `onToggle`.
 */
export function CollectionsSheet({ recipe, collections, onToggle, onClose }) {
  return (
    <SwipeableSheet onClose={onClose}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Carnets</h3>
      <p style={{ fontSize: 13, color: "var(--text2)", marginBottom: 16 }}>Range <strong>{recipe.name}</strong> dans tes carnets</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {(collections || []).map(col => {
          const active = (recipe.collections || []).includes(col.id);
          return (
            <button key={col.id} onClick={() => onToggle(recipe.id, col.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, background: active ? col.color + "22" : "var(--surface2)", border: `1.5px solid ${active ? col.color : "var(--border)"}`, transition: "all 0.15s" }}>
              <div style={{ width: 14, height: 14, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500, textAlign: "left", color: active ? col.color : "var(--text)" }}>{col.name}</span>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: active ? col.color : "transparent", border: `2px solid ${active ? col.color : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {active && <Icon name="check" size={12} color="#fff" />}
              </div>
            </button>
          );
        })}
        {(!collections || collections.length === 0) && <p style={{ color: "var(--text3)", fontSize: 13 }}>Aucun carnet. Créez-en dans l'onglet Config.</p>}
      </div>
      <button className="btn btn-primary" style={{ width: "100%" }} onClick={onClose}>Fermer</button>
    </SwipeableSheet>
  );
}
