import type { CSSProperties } from "react";
import { Icon } from "../ui/Icon.jsx";
import { TIP_TYPES, TIP_ORDER } from "../../constants/tipTypes.js";
import type { IngredientTip } from "@/lib/types.js";

const CARD: CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" };

interface IngredientTipsEditorProps {
  tips: IngredientTip[];
  onChange: (tips: IngredientTip[]) => void;
}

/** Édition en place des conseils d'un ingrédient (type + texte, ajout, suppression). */
export function IngredientTipsEditor({ tips, onChange }: IngredientTipsEditorProps) {
  const patch = (idx: number, change: Partial<IngredientTip>) => onChange(tips.map((t, i) => i === idx ? { ...t, ...change } : t));
  return (
    <div className="slide-up" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700 }}>Tips utiles</div>
        <button onClick={() => onChange([...tips, { type: "prep", text: "" }])} className="pressable" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "rgba(var(--accent-rgb),0.1)", border: "1px solid rgba(var(--accent-rgb),0.28)", borderRadius: 999, padding: "5px 12px", cursor: "pointer" }}>
          <Icon name="plus" size={13} color="var(--accent)" /> Ajouter
        </button>
      </div>
      {tips.length === 0 && <div style={{ fontSize: 12.5, color: "var(--text3)", fontStyle: "italic", padding: "8px 2px" }}>Aucun conseil. Préparation, choix, utilisation ou anti-gaspi.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tips.map((tip, idx) => (
          <div key={idx} style={{ ...CARD, padding: 12, display: "flex", gap: 8, alignItems: "flex-start" }}>
            <select value={tip.type} onChange={e => patch(idx, { type: e.target.value })}
              style={{ width: 130, flexShrink: 0, appearance: "none", WebkitAppearance: "none", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 9px", fontSize: 12, color: "var(--text)", cursor: "pointer" }}>
              {Object.entries(TIP_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            <textarea rows={2} placeholder="Conseil utile…" value={tip.text} onChange={e => patch(idx, { text: e.target.value })}
              style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 9, padding: "7px 11px", fontSize: 12.5, color: "var(--text)", resize: "vertical", minHeight: 40, outline: "none", fontFamily: "var(--ff-body)" }} />
            <button onClick={() => onChange(tips.filter((_, i) => i !== idx))} aria-label="Supprimer" style={{ flexShrink: 0, marginTop: 5, background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}><Icon name="trash" size={15} color="var(--red)" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Conseils d'un ingrédient en consultation, triés dans l'ordre des types. */
export function IngredientTipsList({ tips }: { tips: IngredientTip[] }) {
  return (
    <div className="slide-up" style={{ animationDelay: "0.26s" }}>
      <div style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, margin: "28px 0 12px" }}>Tips utiles</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...tips].sort((a, b) => TIP_ORDER.indexOf(a.type) - TIP_ORDER.indexOf(b.type)).map((tip, i) => {
          const t = TIP_TYPES[tip.type] || TIP_TYPES.prep;
          return (
            <div key={i} style={{ ...CARD, display: "flex", gap: 13, padding: "13px 15px", alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 11, background: t.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{t.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.color, marginBottom: 3, letterSpacing: "0.01em" }}>{t.label}</div>
                <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>{tip.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
