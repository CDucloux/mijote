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

// Libellé de section : phrase courte, discrète, sans capitales (cf. tableau de bord).
function SectionLabel({ children }: { children: string }) {
  return <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text2)", margin: "0 2px 9px" }}>{children}</div>;
}

/**
 * Sous-menu de génération automatique de la semaine : créneaux à remplir, style de
 * repas et bascule batch cooking. La génération elle-même est déléguée au parent.
 * Sans bordure : niveaux de surface et teinte d'accent portent l'état.
 */
export function GenerateSheet({ genSlots, onToggleSlot, genStyle, onPickStyle, genBatch, onToggleBatch, onGenerate, onClose }: GenerateSheetProps) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "82dvh" }}>
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 4px" }}>Générer la semaine</h3>
      <p style={{ fontSize: 13, color: "var(--text3)", margin: "0 0 22px" }}>Les créneaux vides se remplissent selon le style choisi.</p>

      {/* Créneaux à remplir : par défaut midi + soir. Décocher « Midi » quand on
          mange à la cantine en semaine (l'auto-génération le laisse alors libre). */}
      <SectionLabel>Créneaux à remplir</SectionLabel>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {["midi", "soir"].map(slot => {
          const active = genSlots.includes(slot);
          const meta = SLOT_BY_ID[slot];
          return (
            <button key={slot} onClick={() => onToggleSlot(slot)} aria-pressed={active} className={`ripple ${active ? "ripple-light hover-deepen" : "hover-neutral"}`} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
              padding: "11px 0", borderRadius: 999, border: "none", fontSize: 14, fontWeight: 600,
              color: active ? "#fff" : "var(--text2)", background: active ? "var(--accent)" : "var(--surface2)",
              transition: "background-color 0.18s ease, color 0.18s ease",
            }}>
              {meta && <Icon name={meta.icon as IconName} size={16} weight={active ? "fill" : "regular"} color="currentColor" />}
              {meta?.label || slot}
            </button>
          );
        })}
      </div>

      <SectionLabel>Style de repas</SectionLabel>
      <div role="radiogroup" aria-label="Style de repas" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 24 }}>
        {GEN_STYLES.map(o => {
          const active = genStyle === o.id;
          return (
            <button key={o.id} role="radio" aria-checked={active} onClick={() => onPickStyle(o.id)} className={`ripple ${active ? "" : "hover-neutral"}`} style={{
              display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", cursor: "pointer",
              padding: "12px 14px 12px 12px", borderRadius: 16, border: "none",
              background: active ? "rgba(var(--accent-rgb),0.12)" : "var(--surface2)",
              transition: "background-color 0.18s ease",
            }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: active ? "var(--accent)" : "var(--surface)", transition: "background-color 0.18s ease" }}>
                <Icon name={o.icon} size={18} color={active ? "#fff" : "var(--text2)"} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>{o.title}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--text3)", lineHeight: 1.4, marginTop: 2 }}>{o.desc}</span>
              </span>
              {/* Radio : seul contour toléré, il porte l'état sélectionné. */}
              <span aria-hidden="true" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: "50%", boxSizing: "border-box", border: active ? "6px solid var(--accent)" : "2px solid var(--text3)", opacity: active ? 1 : 0.5, transition: "border 0.18s ease, opacity 0.18s ease" }} />
            </button>
          );
        })}
      </div>

      {/* Batch cooking : tout préparer d'avance (ex. le dimanche). */}
      <button role="switch" aria-checked={genBatch} onClick={onToggleBatch} className="ripple hover-neutral" style={{
        display: "flex", alignItems: "center", gap: 13, width: "100%", textAlign: "left", cursor: "pointer",
        padding: "12px 14px 12px 12px", borderRadius: 16, border: "none", marginBottom: 20, background: "var(--surface2)",
      }}>
        <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--surface)" }}>
          <Icon name="layers" size={18} color="var(--text2)" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: "var(--text)" }}>Batch cooking</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--text3)", lineHeight: 1.4, marginTop: 2 }}>Tout ce qu'il y a à cuisiner dans la semaine, regroupé en une session à préparer d'avance.</span>
        </span>
        <span aria-hidden="true" style={{ position: "relative", width: 40, height: 23, borderRadius: 999, flexShrink: 0, background: genBatch ? "var(--accent)" : "var(--surface3)", transition: "background 0.25s ease" }}>
          <span style={{ position: "absolute", top: 2.5, left: 2.5, width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.28)", transform: genBatch ? "translateX(17px)" : "translateX(0)", transition: "transform 0.28s cubic-bezier(0.34,1.5,0.64,1)" }} />
        </span>
      </button>
      <button className="btn btn-primary btn-pill" style={{ width: "100%", padding: "14px 0", fontSize: 15 }} onClick={onGenerate} disabled={genSlots.length === 0}>
        <Icon name="sparkle" size={16} /> Générer la semaine
      </button>
    </SwipeableSheet>
  );
}
