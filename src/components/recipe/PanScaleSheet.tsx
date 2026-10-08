import { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { panFactor, roundNice, type PanDims } from "@/lib/food/calculators.js";

// ─── ADAPTER AU MOULE ─────────────────────────────────────────────────────────
// Passe d'un moule à l'autre : les quantités de la recette suivent le rapport des
// surfaces (ou des volumes si les deux hauteurs sont connues). Ouvert depuis la
// fiche recette ; les équivalents en cuillères vivent, eux, dans le mode cuisine.

function NumField({ label, value, onChange, suffix }: { label: string; value: string | number | undefined; onChange: (v: string) => void; suffix?: string }) {
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
function PanForm({ title, pan, set }: { title: string; pan: PanDims; set: (next: PanDims) => void }) {
  const upd = (k: keyof PanDims, v: string) => set({ ...pan, [k]: v });
  return (
    <div style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
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

interface PanScaleSheetProps {
  /** Une adaptation au moule est déjà appliquée (affiche la réinitialisation). */
  applied?: boolean;
  onApply: (factor: number) => void;
  onReset: () => void;
  onClose: () => void;
}

/** Feuille d'adaptation des quantités à un autre moule (facteur de surface ou de volume). */
export function PanScaleSheet({ applied, onApply, onReset, onClose }: PanScaleSheetProps) {
  const [orig, setOrig] = useState<PanDims>({ shape: "round", diameter: "", length: "", width: "", height: "" });
  const [target, setTarget] = useState<PanDims>({ shape: "round", diameter: "", length: "", width: "", height: "" });
  const factor = panFactor(orig, target);
  const useVolume = Number(orig.height) > 0 && Number(target.height) > 0;

  return (
    <SwipeableSheet onClose={onClose}>
      <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 12px" }}>Adapter au moule</h3>
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
            <button className="btn btn-primary" onClick={() => { onApply(factor); onClose(); }} style={{ flexShrink: 0 }}>
              <Icon name="check" size={15} /> Adapter la recette
            </button>
          </div>
        )}
        {applied && (
          <button className="btn btn-ghost" onClick={() => { onReset(); onClose(); }} style={{ fontSize: 12.5 }}>
            Réinitialiser (moule d'origine)
          </button>
        )}
      </div>
    </SwipeableSheet>
  );
}
