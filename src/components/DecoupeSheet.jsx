import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";
import { capitalize } from "../lib/format.js";
import { FORMES, FORME_LABEL } from "@/lib/recipes/decoupe.js";

// ─── FEUILLE DE DÉCOUPE ───────────────────────────────────────────────────────
// Choix de la découpe de mise en place (forme + calibre), en remplacement des deux
// listes déroulantes « stock » de la ligne d'ingrédient. Édition en direct : chaque
// choix remonte via `onChange`, la feuille reste ouverte pour affiner le calibre.

const CALIBRES = [["fin", "Fin"], ["moyen", "Moyen"], ["gros", "Gros"]];

/**
 * Feuille de sélection de la découpe d'un ingrédient. Contrôlée : l'état vit chez le
 * parent (`cut`), chaque geste appelle `onChange` avec la nouvelle découpe ou `null`.
 *
 * @param {string} name Nom de l'ingrédient (sous-titre).
 * @param {import("@/lib/types").Cut | null | undefined} cut Découpe courante.
 * @param {(cut: import("@/lib/types").Cut | null) => void} onChange
 * @param {() => void} onClose
 */
export function DecoupeSheet({ name, cut, onChange, onClose }) {
  const forme = cut?.forme || null;
  const calibre = cut?.calibre || null;

  const pickForme = (f) => onChange(calibre ? { forme: f, calibre } : { forme: f });
  const pickCalibre = (c) => forme && onChange(c === calibre ? { forme } : { forme, calibre: c });

  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (
      <>
      {/* En-tête : icône couteau + intitulé, nom de l'ingrédient en sous-titre. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, background: "rgba(var(--accent-rgb),0.12)", display: "grid", placeItems: "center" }}>
          <Icon name="knife" size={22} color="var(--accent)" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, color: "var(--text)", lineHeight: 1.15 }}>Découpe</div>
          {name && <div style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{capitalize(name)}</div>}
        </div>
      </div>

      {/* Formes : grille de pills, l'active en accent plein. */}
      <div style={{ fontSize: 12.5, color: "var(--text3)", fontWeight: 700, letterSpacing: 0.2, textTransform: "uppercase", margin: "0 2px 10px" }}>Forme</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {FORMES.map(f => {
          const active = forme === f;
          return (
            <button key={f} type="button" className="tap ripple" onClick={() => pickForme(f)}
              aria-pressed={active}
              style={{ padding: "9px 15px", borderRadius: 999, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                background: active ? "var(--accent)" : "var(--surface2)",
                color: active ? "#fff" : "var(--text2)",
                border: active ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
              {FORME_LABEL[f]}
            </button>
          );
        })}
      </div>

      {/* Calibre : segmenté, révélé une fois la forme choisie. Optionnel (re-tap = retire). */}
      {forme && (
        <>
          <div style={{ fontSize: 12.5, color: "var(--text3)", fontWeight: 700, letterSpacing: 0.2, textTransform: "uppercase", margin: "22px 2px 10px" }}>Calibre</div>
          <div style={{ display: "flex", gap: 8 }}>
            {CALIBRES.map(([v, l]) => {
              const active = calibre === v;
              return (
                <button key={v} type="button" className="tap ripple" onClick={() => pickCalibre(v)}
                  aria-pressed={active}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 14, fontSize: 14, fontWeight: 650, cursor: "pointer",
                    background: active ? "rgba(var(--accent-rgb),0.14)" : "var(--surface2)",
                    color: active ? "var(--accent)" : "var(--text3)",
                    border: active ? "1px solid var(--accent)" : "1px solid var(--border)" }}>
                  {l}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Retrait de la découpe : présent seulement s'il y a quelque chose à retirer. */}
      {forme && (
        <button type="button" className="pressable" onClick={() => close(() => onChange(null))}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", marginTop: 22, padding: "12px 0", borderRadius: 14, fontSize: 13.5, fontWeight: 600, cursor: "pointer", color: "var(--red)", background: "rgba(var(--red-rgb),0.08)", border: "none" }}>
          <Icon name="trash" size={15} color="var(--red)" /> Retirer la découpe
        </button>
      )}
      </>
      )}
    </SwipeableSheet>
  );
}
