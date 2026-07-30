import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { SORT_OPTIONS, sortOption, defaultDirFor } from "../lib/recipeSort.js";

// ─── FEUILLE DE TRI ────────────────────────────────────────────────────────────
// Choix du critère (liste) + du sens de lecture (segmenté, libellés parlants).
// Sélectionner un critère réinitialise le sens sur son ordre naturel.
export function SortSheet({ sortBy, sortDir, onChange, onClose }) {
  const current = sortOption(sortBy);
  const pick = (key) => onChange(key, defaultDirFor(key));

  return (
    <SwipeableSheet onClose={onClose}>
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 4px" }}>Trier les recettes</h3>
      <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "0 0 16px" }}>Choisis un critère, puis le sens.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SORT_OPTIONS.map(o => {
          const on = o.key === sortBy;
          return (
            <button key={o.key} onClick={() => pick(o.key)} className="pressable" style={{
              display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left",
              padding: "12px 14px", borderRadius: 15, cursor: "pointer",
              background: on ? "rgba(232,112,58,0.1)" : "var(--surface2)",
              border: `1px solid ${on ? "rgba(232,112,58,0.42)" : "var(--border)"}`,
            }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: on ? "rgba(232,112,58,0.18)" : "var(--surface3)" }}>
                {o.icon === "az"
                  ? <span style={{ fontFamily: "var(--ff-display)", fontSize: 14, fontWeight: 700, color: on ? "var(--accent)" : "var(--text2)" }}>Az</span>
                  : <Icon name={o.icon} size={19} color={on ? "var(--accent)" : "var(--text2)"} />}
              </span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: on ? "var(--accent)" : "var(--text)" }}>{o.label}</span>
              {on && <Icon name="check" size={17} color="var(--accent)" />}
            </button>
          );
        })}
      </div>

      {/* Sens de lecture pour le critère sélectionné */}
      <div style={{ marginTop: 18 }}>
        <div className="field-label" style={{ marginBottom: 8 }}>Sens</div>
        <div style={{ display: "flex", gap: 8, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 14, padding: 4 }}>
          {current.dirs.map(d => {
            const on = d.dir === sortDir;
            return (
              <button key={d.dir} onClick={() => onChange(sortBy, d.dir)} style={{
                flex: 1, padding: "10px 8px", borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
                background: on ? "var(--accent)" : "transparent",
                color: on ? "#fff" : "var(--text2)",
                boxShadow: on ? "0 4px 12px -4px rgba(232,112,58,0.6)" : "none",
                transition: "background 0.15s, color 0.15s",
              }}>{d.label}</button>
            );
          })}
        </div>
      </div>
    </SwipeableSheet>
  );
}
