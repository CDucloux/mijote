import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";

// ─── POPUP D'ERREUR ───────────────────────────────────────────────────────────
// Remplace le « texte rouge » discret par une vraie fenêtre centrée : titre,
// message clair, et l'origine technique (`code`) affichée en petit pour le
// diagnostic. Boutons Fermer / Réessayer optionnel.
export function ErrorModal({ title = "Une erreur est survenue", message, code, onClose, onRetry, retryLabel = "Réessayer" }) {
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 800, background: "rgba(20,15,12,0.55)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 24, animation: "fadeIn 0.18s backwards" }}>
      <div onClick={e => e.stopPropagation()} className="slide-up" style={{ width: "100%", maxWidth: 360, background: "var(--surface)", borderRadius: 22, padding: "26px 22px 20px", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.4)" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px", background: "rgba(224,82,82,0.12)", border: "1px solid rgba(224,82,82,0.3)", display: "grid", placeItems: "center" }}>
          <Icon name="warning" size={28} color="var(--red)" />
        </div>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 8px" }}>{title}</h3>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.55, margin: "0 0 14px" }}>{message}</p>
        {code && (
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: "var(--text3)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 9px", marginBottom: 18, fontFamily: "ui-monospace, monospace" }}>
            {code}
          </span>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: code ? 0 : 6 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Fermer</button>
          {onRetry && <button className="btn btn-primary" style={{ flex: 1 }} onClick={onRetry}><Icon name="history" size={15} /> {retryLabel}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
