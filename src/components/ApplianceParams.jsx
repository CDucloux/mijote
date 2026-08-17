import { Icon } from "./Icon.jsx";
import { getApplianceSchema } from "@/lib/utensils/appliances.js";

// ─── RÉGLAGES D'APPAREIL (niveau étape) ───────────────────────────────────────
// Éditeur compact des paramètres de fonctionnement d'un appareil (four, blender…)
// posés SUR une étape. Le schéma (quels réglages) est figé côté lib ; ici on ne
// fait que rendre chaque champ (bool / enum / number) en primitives sleek.

const chipBase = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
  borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
  transition: "background 0.15s, border-color 0.15s, color 0.15s",
};
const chipOn = { background: "rgba(232,112,58,0.14)", color: "var(--accent)", border: "1px solid rgba(232,112,58,0.5)" };
const chipOff = { background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)" };
const fieldLabel = { fontSize: 11.5, fontWeight: 600, color: "var(--text3)", marginBottom: 6, letterSpacing: "0.01em" };

/**
 * Éditeur des réglages d'un appareil pour une étape donnée.
 *
 * @param {string} appliance - Clé d'appareil (schéma).
 * @param {Record<string, unknown>} values - Valeurs courantes (indexées par clé de réglage).
 * @param {(next: Record<string, unknown>) => void} onChange - Reçoit le nouvel objet de valeurs (nettoyé des vides).
 */
export function ApplianceParamsEditor({ appliance, values, onChange }) {
  const schema = getApplianceSchema(appliance);
  if (schema.length === 0) return null;

  // Écrit une valeur en écartant les « vides » (chaîne vide, null, false) pour
  // garder l'objet Firestore propre et éviter les NaN.
  const set = (key, val) => {
    const next = { ...(values || {}) };
    if (val === "" || val == null || val === false) delete next[key];
    else next[key] = val;
    onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {schema.map(field => {
        const cur = values?.[field.key];

        if (field.kind === "bool") {
          const on = cur === true;
          return (
            <button key={field.key} type="button" onClick={() => set(field.key, !on)} className="pressable"
              style={{ ...chipBase, ...(on ? chipOn : chipOff), alignSelf: "flex-start" }}>
              <Icon name={on ? "check" : "plus"} size={12} color={on ? "var(--accent)" : "var(--text3)"} />
              {field.label}
            </button>
          );
        }

        if (field.kind === "enum") {
          return (
            <div key={field.key}>
              <div style={fieldLabel}>{field.label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {field.options.map(opt => {
                  const on = cur === opt.value;
                  return (
                    <button key={opt.value} type="button" onClick={() => set(field.key, on ? "" : opt.value)} className="pressable"
                      style={{ ...chipBase, ...(on ? chipOn : chipOff) }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }

        // number : saisie compacte avec suffixe d'unité.
        const raw = cur === undefined || cur === null ? "" : cur;
        return (
          <div key={field.key}>
            <div style={fieldLabel}>{field.label}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "6px 12px" }}>
              <input type="number" inputMode="numeric" value={raw}
                min={field.min} max={field.max} step={field.step}
                placeholder="-"
                onChange={e => { const v = e.target.value; const n = v === "" ? "" : Number(v); set(field.key, Number.isNaN(n) ? "" : n); }}
                style={{ width: 64, border: "none", background: "transparent", color: "var(--text)", fontSize: 14, fontWeight: 600, outline: "none", MozAppearance: "textfield" }} />
              {field.unit && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text3)" }}>{field.unit}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
