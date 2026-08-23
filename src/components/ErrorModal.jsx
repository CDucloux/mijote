import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useModalExit } from "../hooks/useModalExit.js";

// ─── POPUP D'ERREUR ───────────────────────────────────────────────────────────
// Remplace le « texte rouge » discret par une vraie fenêtre centrée : titre,
// message clair, et l'origine technique (`code`) affichée en petit pour le
// diagnostic. Boutons Fermer / Réessayer optionnel. Même coquille .alert-* que
// les confirmations (entrée + sortie animées).
export function ErrorModal({ title = "Une erreur est survenue", message, code, onClose, onRetry, retryLabel = "Réessayer" }) {
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit(onClose);
  return createPortal(
    <div onClick={() => beginClose()} className={`alert-backdrop${closing ? " is-closing" : ""}`} style={{ zIndex: 800 }}>
      <div ref={surfaceRef} onClick={e => e.stopPropagation()} className={`alert-dialog${closing ? " is-closing" : ""}`} role="alertdialog" aria-label={title} onAnimationEnd={onAnimationEnd}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px", background: "rgba(224,82,82,0.12)", border: "1px solid rgba(224,82,82,0.3)", display: "grid", placeItems: "center" }}>
          <Icon name="warning" size={28} color="var(--red)" />
        </div>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 8px", textAlign: "center" }}>{title}</h3>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.55, margin: "0 0 14px", textAlign: "center" }}>{message}</p>
        {code && (
          <div style={{ textAlign: "center" }}>
            <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, color: "var(--text3)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "3px 9px", marginBottom: 18, fontFamily: "ui-monospace, monospace" }}>
              {code}
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: code ? 0 : 6 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => beginClose()}>Fermer</button>
          {onRetry && <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => beginClose(onRetry)}><Icon name="history" size={15} /> {retryLabel}</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
