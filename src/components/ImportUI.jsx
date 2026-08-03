import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";

// ─── UI PARTAGÉE DES IMPORTS IA (lien / photo) ───────────────────────────────
// L'import IA consomme un crédit : l'écran d'attente est VOLONTAIREMENT
// non-annulable (pas de fermeture, pas de swipe, pas de bouton) pour éviter
// qu'un crédit parte dans le vide.

const LOADING_STEPS = [
  "Lecture de la page…",
  "Repérage de la recette…",
  "Extraction des ingrédients…",
  "Rédaction des étapes…",
  "Presque prêt…",
];

/** Overlay plein écran non-annulable pendant l'extraction IA. */
export function LoadingOverlay() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(v => Math.min(v + 1, LOADING_STEPS.length - 1)), 2400);
    return () => clearInterval(t);
  }, []);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(20,15,12,0.72)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 24, animation: "fadeIn 0.2s backwards" }}>
      <div style={{ width: "100%", maxWidth: 340, background: "var(--surface)", borderRadius: 24, padding: "34px 26px 28px", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}>
        {/* Marmite qui pulse dans un anneau qui tourne */}
        <div style={{ position: "relative", width: 84, height: 84, margin: "0 auto 20px" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid var(--surface3)", borderTopColor: "var(--accent)", animation: "spin 0.9s linear infinite" }} />
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 34, animation: "potPulse 1.6s ease-in-out infinite" }}>🍲</div>
        </div>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, margin: "0 0 6px" }}>On mijote ta recette…</h3>
        <div style={{ fontSize: 13.5, color: "var(--accent)", fontWeight: 600, minHeight: 20, transition: "opacity 0.3s" }}>{LOADING_STEPS[i]}</div>
        <div style={{ display: "inline-flex", gap: 4, margin: "12px 0 14px" }}>
          {[0, 1, 2].map(d => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: `importDots 1.2s ${d * 0.16}s ease-in-out infinite` }} />)}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text3)", lineHeight: 1.5 }}>
          Garde cette fenêtre ouverte : l'extraction est en cours et ne peut pas être interrompue.
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Bandeau d'erreur inline (URL invalide, trop de photos…). Les VRAIS échecs
 * d'import passent, eux, par ErrorModal (popup centrée). */
export function InlineError({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 10, background: "rgba(224,82,82,0.10)", border: "1px solid rgba(224,82,82,0.28)", margin: "0 0 14px" }}>
      <Icon name="warning" size={15} color="var(--red)" />
      <span style={{ fontSize: 12.5, color: "var(--red)", fontWeight: 600, lineHeight: 1.4 }}>{children}</span>
    </div>
  );
}

/** Carte d'aide discrète (icône + texte) : partage navigateur, confidentialité… */
export function HintCard({ icon, iconColor = "var(--text3)", children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 14px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)" }}>
      <Icon name={icon} size={17} color={iconColor} />
      <span style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

/** En-tête de page d'import : bouton retour + pastille + titre. */
export function ImportHeader({ icon, title, onBack }) {
  return (
    <div style={{ padding: "18px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={onBack} aria-label="Retour" style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}>
        <Icon name="back" size={17} />
      </button>
      <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(232,112,58,0.15)", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon name={icon} size={16} color="var(--accent)" />
      </span>
      <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>{title}</h1>
    </div>
  );
}
