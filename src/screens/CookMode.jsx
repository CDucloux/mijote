import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../components/Icon.jsx";
import { Img, IngImage } from "../components/Img.jsx";
import { findIngredientMatch } from "../lib/nameMatcher.js";
import { normalizeStr } from "../lib/parseIngredient.js";

// ─── COOK MODE ────────────────────────────────────────────────────────────────
export function CookMode({ recipe, mult, ingredientDB, utensilDB, onClose }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);

  const step = recipe.steps[stepIdx];
  const total = recipe.steps.length;
  const linkedIngs = recipe.ingredients.filter(i => step.ingredients?.includes(i.id));
  const linkedUts = (recipe.utensils || []).filter(u => step.utensils?.includes(u.id));

  const getIngImage = (dbId, name) => ingredientDB.find(d => d.id === dbId)?.image || (name ? findIngredientMatch(name, ingredientDB)?.image || "" : "");
  const getUtImage = (dbId, name) => (utensilDB || []).find(d => d.id === dbId)?.image || (name ? (utensilDB || []).find(d => normalizeStr(d.name) === normalizeStr(name))?.image || "" : "");
  const progress = ((stepIdx + 1) / total) * 100;

  return createPortal(
    <>
      {done && (
        <div style={{ position: "fixed", inset: 0, zIndex: 501, background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "cookModeIn 0.4s ease", padding: 32, textAlign: "center" }}>
          {/* Floating emojis */}
          {["🍽️", "✨", "🎉", "👨‍🍳", "⭐", "🥳"].map((e, i) => (
            <span key={i} style={{
              position: "absolute", fontSize: 28 + i * 4, animation: `floatUp ${1.2 + i * 0.3}s ease forwards`, animationDelay: `${i * 0.15}s`,
              left: `${10 + i * 14}%`, top: `${60 + Math.sin(i) * 15}%`, pointerEvents: "none"
            }}>{e}</span>
          ))}
          <div style={{ animation: "popIn 0.6s cubic-bezier(0.34,1.56,0.64,1)", marginBottom: 24 }}>
            <div style={{ fontSize: 72, lineHeight: 1 }}>🍳</div>
          </div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 12, animation: "popIn 0.6s 0.2s both cubic-bezier(0.34,1.56,0.64,1)" }}>
            Félicitations !
          </h1>
          <p style={{ fontSize: 16, color: "var(--text2)", lineHeight: 1.6, marginBottom: 32, maxWidth: 300, animation: "popIn 0.5s 0.35s both ease" }}>
            Votre <strong style={{ color: "var(--text)" }}>{recipe.name}</strong> est prêt·e !
          </p>
          <button className="btn btn-primary" style={{ padding: "14px 32px", fontSize: 16, borderRadius: 16, animation: "popIn 0.5s 0.5s both ease" }} onClick={onClose}>
            <Icon name="check" size={18} /> Retour à la recette
          </button>
        </div>
      )}

      <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "var(--bg)", display: "flex", flexDirection: "column", animation: "cookModeIn 0.45s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="close" size={18} /></button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{recipe.name}</div>
            <div style={{ fontSize: 12, color: "var(--text3)" }}>Étape {stepIdx + 1} / {total}</div>
          </div>

        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: "var(--surface2)", flexShrink: 0 }}>
          <div style={{ height: "100%", background: "var(--accent)", width: `${progress}%`, transition: "width 0.4s ease" }} />
        </div>


        {/* Main content — desktop: sidebar + content, mobile: single col */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>

          {/* Desktop sidebar — steps list */}
          <div className="cook-mode-sidebar" style={{ display: "none", width: 260, minWidth: 260, overflowY: "auto", borderRight: "1px solid var(--border)", padding: "12px 0" }}>
            {recipe.steps.map((s, i) => (
              <button key={s.id} onClick={() => setStepIdx(i)}
                style={{
                  width: "100%", display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", background: i === stepIdx ? "rgba(232,112,58,0.1)" : "none",
                  borderLeft: `3px solid ${i === stepIdx ? "var(--accent)" : "transparent"}`, textAlign: "left", transition: "all 0.15s"
                }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                  background: i < stepIdx ? "var(--green)" : i === stepIdx ? "var(--accent)" : "var(--surface2)",
                  color: i <= stepIdx ? "#fff" : "var(--text3)"
                }}>
                  {i < stepIdx ? <Icon name="check" size={11} color="#fff" /> : i + 1}
                </div>
                <span style={{ fontSize: 13, color: i === stepIdx ? "var(--accent)" : i < stepIdx ? "var(--text3)" : "var(--text2)", fontWeight: i === stepIdx ? 600 : 400, lineHeight: 1.4 }}>{`Étape ${i + 1}`}</span>
              </button>
            ))}
          </div>

          {/* Step content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
            <div style={{ maxWidth: 640, margin: "0 auto" }}>
              {/* Step header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{stepIdx + 1}</div>
                <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 500 }}>Étape {stepIdx + 1}</h2>
              </div>

              {/* Step text */}
              <p style={{ fontSize: 16, color: "var(--text)", lineHeight: 1.8, marginBottom: 24 }}>{step.text}</p>

              {/* Linked ingredients */}
              {linkedIngs.length > 0 && (
                <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Pour cette étape</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {linkedIngs.map(ing => (
                      <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <IngImage src={getIngImage(ing.dbId, ing.name)} alt={ing.name} size={42} />
                        <span style={{ flex: 1, fontSize: 14 }}>{ing.name}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>{+(ing.amount * mult).toFixed(2)} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ustensiles de l'étape */}
              {linkedUts.length > 0 && (
                <div style={{ background: "var(--surface)", borderRadius: 14, padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Ustensiles</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {linkedUts.map(u => (
                      <span key={u.id} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)" }}>
                        <div style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", background: "#fff", flexShrink: 0 }}><Img src={getUtImage(u.dbId, u.name)} alt={u.name} style={{ width: "100%", height: "100%" }} /></div>
                        {u.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStepIdx(i => Math.max(0, i - 1))} disabled={stepIdx === 0}>
            <Icon name="back" size={16} /> Précédent
          </button>
          <span style={{ fontSize: 12, color: "var(--text3)", minWidth: 60, textAlign: "center" }}>{stepIdx + 1} / {total}</span>
          {stepIdx < total - 1
            ? <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStepIdx(i => i + 1)}>Suivant <Icon name="forward" size={16} /></button>
            : <button className="btn btn-primary" style={{ flex: 1, background: "var(--green)" }} onClick={() => setDone(true)}><Icon name="check" size={16} /> Terminé !</button>
          }
        </div>
      </div>
    </>,
    document.body
  );
}
