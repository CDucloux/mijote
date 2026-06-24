import { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
import { useOnline } from "../hooks/useOnline.js";

// Signale une perte de connexion durable via un modal — sans être intempestif :
// on n'affiche qu'après OFFLINE_DELAY ms hors ligne continu (les micro-coupures
// d'une connexion instable sont donc ignorées). Le modal se ferme tout seul au
// retour en ligne, et ne se ré-affiche pas tant qu'on reste connecté.
const OFFLINE_DELAY = 3000;

export function OfflineModal() {
  const online = useOnline();
  const [show, setShow] = useState(false);
  const timer = useRef(null);

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

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.18s ease" }}
      onClick={() => setShow(false)}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "26px 22px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.45)", textAlign: "center", animation: "modalIn 0.32s cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(240,153,42,0.14)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Icon name="wifiOff" size={24} color="var(--orange)" />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Vous êtes hors ligne</div>
        <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: 22 }}>
          Pas d'inquiétude : vous pouvez continuer à consulter et modifier vos recettes. Tout sera synchronisé automatiquement dès le retour de la connexion.
        </div>
        <button onClick={() => setShow(false)} style={{ width: "100%", padding: "11px 0", borderRadius: 12, background: "var(--accent)", border: "1px solid var(--accent)", color: "#fff", fontFamily: "var(--ff-body)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>J'ai compris</button>
      </div>
    </div>
  );
}
