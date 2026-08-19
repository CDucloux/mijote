import { useState, useMemo } from "react";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { panFactor, roundNice, densityFor, convertQuantity, CONVERT_UNITS } from "@/lib/food/calculators.js";

// ─── CALCULATRICES DE RECETTE ───────────────────────────────────────────────────
// Deux outils : adapter les quantités à un autre moule, et convertir une unité
// (masse ↔ volume via la densité de l'ingrédient). Ouvert depuis la fiche recette.

const UNIT_LABEL = {
  g: "g", kg: "kg", ml: "ml", cl: "cl", l: "L",
  "cuillère à soupe": "c. à soupe", "cuillère à café": "c. à café", cup: "cup", tasse: "tasse",
};

function NumField({ label, value, onChange, suffix }) {
  return (
    <label style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 11, color: "var(--text3)", marginBottom: 4, fontWeight: 600 }}>{label}</span>
      <div style={{ position: "relative" }}>
        <input className="field-input" type="number" inputMode="decimal" min="0" value={value}
          onChange={e => onChange(e.target.value)} style={{ paddingRight: suffix ? 34 : undefined }} />
        {suffix && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--text3)", pointerEvents: "none" }}>{suffix}</span>}
      </div>
    </label>
  );
}

// Un moule : forme (rond/rect) + dimensions + hauteur optionnelle.
function PanForm({ title, pan, set }) {
  const upd = (k, v) => set({ ...pan, [k]: v });
  return (
    <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 9, padding: 3 }}>
          {[["round", "Rond"], ["rect", "Rectangle"]].map(([s, lbl]) => (
            <button key={s} onClick={() => upd("shape", s)} style={{
              fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer",
              background: pan.shape === s ? "var(--accent)" : "transparent", color: pan.shape === s ? "#fff" : "var(--text2)",
            }}>{lbl}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 9 }}>
        {pan.shape === "round"
          ? <NumField label="Diamètre" value={pan.diameter} onChange={v => upd("diameter", v)} suffix="cm" />
          : <>
              <NumField label="Longueur" value={pan.length} onChange={v => upd("length", v)} suffix="cm" />
              <NumField label="Largeur" value={pan.width} onChange={v => upd("width", v)} suffix="cm" />
            </>}
        <NumField label="Hauteur" value={pan.height} onChange={v => upd("height", v)} suffix="cm" />
      </div>
    </div>
  );
}

function MouleTab({ onApply, onReset, applied }) {
  const [orig, setOrig] = useState({ shape: "round", diameter: "", length: "", width: "", height: "" });
  const [target, setTarget] = useState({ shape: "round", diameter: "", length: "", width: "", height: "" });
  const factor = panFactor(orig, target);
  const useVolume = Number(orig.height) > 0 && Number(target.height) > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: 0 }}>
        Passe d'un moule à l'autre : les quantités s'adaptent au <strong style={{ color: "var(--text2)" }}>rapport des surfaces</strong>
        {" "}(ou des volumes si tu renseignes les deux hauteurs).
      </p>
      <PanForm title="Moule de la recette" pan={orig} set={setOrig} />
      <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 18, lineHeight: 1 }}>↓</div>
      <PanForm title="Ton moule" pan={target} set={setTarget} />

      {factor != null && (
        <div style={{ background: "linear-gradient(158deg, rgba(var(--accent-rgb),0.12), var(--surface2) 80%)", border: "1px solid rgba(var(--accent-rgb),0.3)", borderRadius: 14, padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600 }}>Facteur {useVolume ? "de volume" : "de surface"}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)", fontFamily: "var(--ff-display)" }}>× {roundNice(factor)}</div>
          </div>
          <button className="btn btn-primary" onClick={() => onApply(factor)} style={{ flexShrink: 0 }}>
            <Icon name="check" size={15} /> Adapter la recette
          </button>
        </div>
      )}
      {applied && (
        <button className="btn btn-ghost" onClick={onReset} style={{ fontSize: 12.5 }}>
          Réinitialiser (moule d'origine)
        </button>
      )}
    </div>
  );
}

function ConvertTab({ ingredients }) {
  const [value, setValue] = useState("100");
  const [from, setFrom] = useState("g");
  const [to, setTo] = useState("ml");
  const [ingName, setIngName] = useState("");

  const knownIngs = useMemo(() => {
    const seen = new Set();
    return (ingredients || []).filter(i => i?.name && !seen.has(i.name) && seen.add(i.name));
  }, [ingredients]);

  const density = ingName ? densityFor(ingName) : null;
  const result = convertQuantity(value, from, to, density);
  const needsDensity = result == null && Number(value) > 0 &&
    // croisement masse/volume détecté ⇒ densité manquante
    ((["g", "kg"].includes(from) && !["g", "kg"].includes(to)) || (!["g", "kg"].includes(from) && ["g", "kg"].includes(to)));

  const UnitSelect = ({ val, set }) => (
    <select className="field-input" value={val} onChange={e => set(e.target.value)} style={{ appearance: "auto" }}>
      {CONVERT_UNITS.map(u => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
    </select>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, margin: 0 }}>
        Convertis une quantité. Pour passer des grammes aux millilitres (ou l'inverse),
        choisis l'ingrédient pour utiliser sa <strong style={{ color: "var(--text2)" }}>densité</strong>.
      </p>
      <div style={{ display: "flex", gap: 9, alignItems: "flex-end" }}>
        <NumField label="Quantité" value={value} onChange={setValue} />
        <label style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 11, color: "var(--text3)", marginBottom: 4, fontWeight: 600 }}>De</span>
          <UnitSelect val={from} set={setFrom} />
        </label>
        <label style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: 11, color: "var(--text3)", marginBottom: 4, fontWeight: 600 }}>Vers</span>
          <UnitSelect val={to} set={setTo} />
        </label>
      </div>

      <label>
        <span style={{ display: "block", fontSize: 11, color: "var(--text3)", marginBottom: 4, fontWeight: 600 }}>Ingrédient (pour la densité)</span>
        <select className="field-input" value={ingName} onChange={e => setIngName(e.target.value)} style={{ appearance: "auto" }}>
          <option value="">Aucun</option>
          {knownIngs.map(i => <option key={i.id || i.name} value={i.name}>{i.name}</option>)}
        </select>
        {ingName && (density != null
          ? <span style={{ fontSize: 11, color: "var(--green)", marginTop: 4, display: "block" }}>Densité ≈ {density} g/ml</span>
          : <span style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, display: "block" }}>Densité inconnue : conversion masse/volume indisponible.</span>)}
      </label>

      <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: "16px", textAlign: "center" }}>
        {result != null ? (
          <>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)", fontFamily: "var(--ff-display)" }}>
              {roundNice(result)} <span style={{ fontSize: 15, color: "var(--text2)", fontWeight: 600 }}>{UNIT_LABEL[to]}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>
              {value || 0} {UNIT_LABEL[from]}{ingName ? ` de ${ingName}` : ""}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text3)" }}>
            {needsDensity ? "Choisis un ingrédient connu pour convertir masse ↔ volume." : "Renseigne une quantité valide."}
          </div>
        )}
      </div>
    </div>
  );
}

export function RecipeCalculators({ recipe, panApplied, onApply, onReset, onClose }) {
  const [tab, setTab] = useState("moule");
  return (
    <SwipeableSheet onClose={onClose}>
      <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px" }}>Calculatrices</h3>
      <div style={{ display: "flex", gap: 4, background: "var(--surface2)", borderRadius: 11, padding: 3, marginBottom: 16 }}>
        {[["moule", "Moule / plat"], ["convert", "Conversions"]].map(([t, lbl]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, fontSize: 13, fontWeight: 600, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
            background: tab === t ? "var(--surface)" : "transparent", color: tab === t ? "var(--text)" : "var(--text3)",
            boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
          }}>{lbl}</button>
        ))}
      </div>
      {tab === "moule"
        ? <MouleTab recipeServings={recipe.servings} applied={panApplied}
            onApply={f => { onApply(f); onClose(); }} onReset={() => { onReset(); onClose(); }} />
        : <ConvertTab ingredients={recipe.ingredients} />}
    </SwipeableSheet>
  );
}
