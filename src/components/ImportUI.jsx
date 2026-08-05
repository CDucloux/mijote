import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";

// ─── UI PARTAGÉE DES IMPORTS IA (lien / photo) ───────────────────────────────
// L'import IA consomme un crédit : l'écran d'attente est VOLONTAIREMENT
// non-annulable (pas de fermeture, pas de swipe, pas de bouton) pour éviter
// qu'un crédit parte dans le vide.

const LOADING_STEPS = [
  "Lecture du contenu…",
  "Repérage de la recette…",
  "Extraction des ingrédients…",
  "Rédaction des étapes…",
  "Presque prêt…",
];

const RING_R = 34; // rayon de l'anneau (le tracé raisonne en % via pathLength)

/**
 * Overlay plein écran non-annulable pendant l'extraction IA, avec une barre de
 * progression circulaire.
 *
 * L'API Claude ne renvoie pas d'avancement en continu : la barre est donc
 * « calée » sur une durée ESTIMÉE (`estimateMs`, fonction du type d'import et du
 * nombre de photos). Elle progresse selon une courbe asymptotique — vite au
 * début, puis de plus en plus lentement — qui atteint ~90 % vers la fin estimée
 * sans jamais toucher 100 % tant que l'extraction n'est pas revenue. Quand la
 * promesse se résout, le composant est démonté : la disparition fait office de
 * « terminé ». Honnête (jamais bloqué à 100 %) et sans à-coups.
 *
 * @param estimateMs - Durée estimée de l'extraction en ms (défaut 14000).
 */
export function LoadingOverlay({ estimateMs = 14000 }) {
  const dur = Math.max(2000, estimateMs);
  // L'ANNEAU est animé en CSS (voir `ringFill`), donc fluide même si React ne
  // re-rend pas pendant l'extraction. Le compteur textuel, lui, suit la MÊME
  // courbe (easeOutCubic) via un timer — secondaire : s'il saute, ce n'est que
  // le chiffre, pas le cercle.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const x = Math.min(1, (performance.now() - start) / dur);
      setProgress(0.92 * (1 - Math.pow(1 - x, 3))); // easeOutCubic, plafonné à 92 %
    }, 200);
    return () => clearInterval(id);
  }, [dur]);

  const stepIdx = Math.min(LOADING_STEPS.length - 1, Math.floor((progress / 0.92) * LOADING_STEPS.length));
  const pct = Math.round(progress * 100);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(20,15,12,0.72)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 24, animation: "fadeIn 0.2s backwards" }}>
      <div style={{ width: "100%", maxWidth: 340, background: "var(--surface)", borderRadius: 24, padding: "34px 26px 28px", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}>
        {/* Marmite STATIQUE au centre d'un anneau de progression qui se remplit. */}
        <div style={{ position: "relative", width: 92, height: 92, margin: "0 auto 18px" }}>
          {/* `pathLength="100"` → dash/offset raisonnent en POURCENTAGE, indépendamment
              du rayon (aucun calcul de circonférence à faire, aucun décalage possible).
              Rotation de -90° portée par un attribut SVG (origine explicite 46,46) pour
              démarrer l'arc en haut — la version CSS `transform` sur le <svg> souffrait
              d'une origine de transformation ambiguë selon le navigateur. */}
          <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
            <circle cx="46" cy="46" r={RING_R} fill="none" stroke="var(--surface3)" strokeWidth="5" />
            <circle cx="46" cy="46" r={RING_R} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round"
              pathLength="100" strokeDasharray="100" strokeDashoffset="100"
              transform="rotate(-90 46 46)"
              style={{ animation: `ringFill ${dur}ms cubic-bezier(0.215,0.61,0.355,1) forwards` }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 34 }}>🍲</div>
        </div>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 600, margin: "0 0 6px" }}>On mijote ta recette…</h3>
        <div style={{ fontSize: 13.5, color: "var(--accent)", fontWeight: 600, minHeight: 20 }}>{LOADING_STEPS[stepIdx]} · {pct}%</div>
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

/** Carte d'aide (pastille d'icône colorée + texte) : partage navigateur,
 * confidentialité… Fond blanc/surface, pastille teintée pour un rendu net. */
export function HintCard({ icon, iconColor = "var(--text2)", tint = "var(--surface3)", children }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 15px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: tint }}>
        <Icon name={icon} size={16} color={iconColor} />
      </span>
      <span style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, paddingTop: 3 }}>{children}</span>
    </div>
  );
}

/** En-tête de page d'import : bouton retour + titre. L'icône identitaire vit dans
 * le bloc d'intro (une seule occurrence) — pas de répétition ici. */
export function ImportHeader({ title, onBack }) {
  return (
    <div style={{ padding: "18px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={onBack} aria-label="Retour" style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}>
        <Icon name="back" size={17} />
      </button>
      <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>{title}</h1>
    </div>
  );
}
