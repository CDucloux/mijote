import { Icon } from "../ui/Icon.jsx";
import type { IconName } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { SLOT_BY_ID } from "../../constants/mealSlots.js";

/** Un style de génération proposé (facile / équilibré / aventureux). */
interface GenStyle {
  id: string;
  icon: IconName;
  title: string;
  desc: string;
}

const GEN_STYLES: GenStyle[] = [
  { id: "facile", icon: "clock", title: "Facile et rapide", desc: "Peu d'ingrédients, préparation et cuisson courtes. Idéal quand on manque de temps." },
  { id: "equilibre", icon: "leaf", title: "Équilibré", desc: "Un bon compromis entre saison, santé, variété et effort." },
  { id: "aventureux", icon: "fire", title: "Aventureux", desc: "Des recettes plus élaborées et plus difficiles, pour se lancer des défis." },
];

/** Props du sous-menu de génération automatique de la semaine. */
interface GenerateSheetProps {
  genSlots: string[];
  onToggleSlot: (slot: string) => void;
  genStyle: string;
  onPickStyle: (id: string) => void;
  genBatch: boolean;
  onToggleBatch: () => void;
  onGenerate: () => void;
  onClose: () => void;
}

/**
 * Sous-menu de génération automatique de la semaine : créneaux à remplir, style de
 * repas et bascule batch cooking. La génération elle-même est déléguée au parent.
 */
export function GenerateSheet({ genSlots, onToggleSlot, genStyle, onPickStyle, genBatch, onToggleBatch, onGenerate, onClose }: GenerateSheetProps) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "82dvh" }}>
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 4px" }}>Générer la semaine</h3>
      <p style={{ fontSize: 12.5, color: "var(--text3)", margin: "0 0 16px" }}>Quel style de repas veux-tu pour les créneaux vides&nbsp;?</p>

      {/* Créneaux à remplir : par défaut midi + soir. Décocher « Midi » quand on
          mange à la cantine en semaine (l'auto-génération le laisse alors libre). */}
      <div style={{ marginBottom: 18 }}>
        <span style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 9 }}>Créneaux à remplir</span>
        <div style={{ display: "flex", gap: 10 }}>
          {["midi", "soir"].map(slot => {
            const active = genSlots.includes(slot);
            return (
              <button key={slot} onClick={() => onToggleSlot(slot)} className="pressable" style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
                padding: "11px 0", borderRadius: 13, fontSize: 14, fontWeight: 600,
                color: active ? "var(--accent)" : "var(--text3)",
                background: active ? "rgba(var(--accent-rgb),0.12)" : "var(--surface2)",
                border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
              }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", display: "grid", placeItems: "center", border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent)" : "transparent" }}>
                  {active && <Icon name="check" size={11} color="#fff" />}
                </span>
                {SLOT_BY_ID[slot]?.label || slot}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {GEN_STYLES.map(o => {
          const active = genStyle === o.id;
          return (
            <button key={o.id} onClick={() => onPickStyle(o.id)} className="pressable" style={{
              display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", cursor: "pointer",
              padding: "13px 14px", borderRadius: 15,
              background: active ? "rgba(var(--accent-rgb),0.12)" : "var(--surface2)",
              border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
            }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: active ? "rgba(var(--accent-rgb),0.2)" : "var(--surface3)" }}>
                <Icon name={o.icon} size={19} color={active ? "var(--accent)" : "var(--text2)"} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>{o.title}</span>
                <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", lineHeight: 1.4, marginTop: 2 }}>{o.desc}</span>
              </span>
              <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", display: "grid", placeItems: "center", border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent)" : "transparent" }}>
                {active && <Icon name="check" size={12} color="#fff" />}
              </span>
            </button>
          );
        })}
      </div>
      {/* Batch cooking : tout préparer d'avance (ex. le dimanche) */}
      <button onClick={onToggleBatch} className="pressable" style={{
        display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", cursor: "pointer",
        padding: "12px 14px", borderRadius: 14, marginBottom: 16,
        background: genBatch ? "rgba(var(--ok-rgb),0.12)" : "var(--surface2)",
        border: `1.5px solid ${genBatch ? "var(--ok)" : "var(--border)"}`,
      }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "grid", placeItems: "center", background: genBatch ? "rgba(var(--ok-rgb),0.2)" : "var(--surface3)" }}>
          <Icon name="fire" size={18} color={genBatch ? "var(--ok)" : "var(--text2)"} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Batch cooking</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--text3)", lineHeight: 1.4, marginTop: 2 }}>Regroupe tout ce qu'il y a à cuisiner pour la semaine en une seule session à préparer d'avance.</span>
        </span>
        <span style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 999, padding: 2, background: genBatch ? "var(--ok)" : "var(--surface3)", display: "flex", justifyContent: genBatch ? "flex-end" : "flex-start", transition: "background 0.15s" }}>
          <span style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff" }} />
        </span>
      </button>
      <button className="btn btn-primary" style={{ width: "100%", borderRadius: 13, padding: "12px 0" }} onClick={onGenerate}>
        <Icon name="calendar" size={16} /> Générer la semaine
      </button>
    </SwipeableSheet>
  );
}
