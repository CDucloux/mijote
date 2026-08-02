import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useOnline } from "../hooks/useOnline.js";
import { useModalExit } from "../hooks/useModalExit.js";

// Signale une perte de connexion durable via un modal – sans être intempestif :
// on n'affiche qu'après OFFLINE_DELAY ms hors ligne continu (les micro-coupures
// d'une connexion instable sont donc ignorées). Le modal se ferme tout seul au
// retour en ligne, et ne se ré-affiche pas tant qu'on reste connecté.
// Réutilise la coquille .alert-* (comme les confirmations) : ton amber = « info,
// pas cassé ». Une seule action (informatif, non destructif).
const OFFLINE_DELAY = 3000;

export function OfflineModal() {
  const online = useOnline();
  const [show, setShow] = useState(false);
  const timer = useRef(null);
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit(() => setShow(false));

  useEffect(() => {
    if (!online) {
      // Attendre une coupure soutenue avant d'alerter (anti-flicker).
      timer.current = setTimeout(() => setShow(true), OFFLINE_DELAY);
    } else {
      // Reconnecté : on annule une alerte en attente et on referme.
      clearTimeout(timer.current);
      setShow(false);
    }
    return () => clearTimeout(timer.current);
  }, [online]);

  if (!show) return null;

  return createPortal(
    <div className={`alert-backdrop${closing ? " is-closing" : ""}`} onClick={() => beginClose()}>
      <div ref={surfaceRef} className={`alert-dialog${closing ? " is-closing" : ""}`} role="alertdialog" aria-label="Tu es hors ligne" onClick={e => e.stopPropagation()} onAnimationEnd={onAnimationEnd}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(240,153,42,0.14)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
          <Icon name="wifiOff" size={24} color="var(--orange)" />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>Tu es hors ligne</h3>
        <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.55, marginBottom: 22, textAlign: "center" }}>
          Pas d'inquiétude : tu peux continuer à consulter et modifier tes recettes. Tout se synchronisera automatiquement au retour de la connexion.
        </p>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => beginClose()}>J'ai compris</button>
      </div>
    </div>,
    document.body
  );
}
