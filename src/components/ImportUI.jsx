import { useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { EmptyArt } from "./EmptyArt.jsx";

// ─── OVERLAY D'ATTENTE DE L'IMPORT INTELLIGENT ───────────────────────────────
// L'import intelligent consomme un crédit : l'écran d'attente est VOLONTAIREMENT
// non-annulable (pas de fermeture, pas de swipe, pas de bouton) pour éviter
// qu'un crédit parte dans le vide.

const LOADING_STEPS = [
  "Lecture du contenu…",
  "Repérage de la recette…",
  "Extraction des ingrédients…",
  "Rédaction des étapes…",
  "Presque prêt…",
];

const RING_R = 45; // rayon de l'anneau (le tracé raisonne en % via pathLength)

/**
 * Overlay plein écran non-annulable pendant l'extraction IA, avec une barre de
 * progression circulaire.
 *
 * L'API Claude ne renvoie pas d'avancement en continu : la barre est donc
 * « calée » sur une durée ESTIMÉE (`estimateMs`, fonction du type d'import et du
 * nombre de photos). Elle progresse selon une courbe asymptotique, vite au
 * début, puis de plus en plus lentement, qui atteint ~90 % vers la fin estimée
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
  // courbe (easeOutCubic) via un timer, secondaire : s'il saute, ce n'est que
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

  // Filtre « encre » propre à cet anneau (id unique, deux-points retirés car
  // `url(#…)` les tolère mal). La graine saute par paliers pour faire « bouillir »
  // le trait (boiling line du dessin animé fait main) ; coupé si l'utilisateur
  // demande moins d'animations.
  const ringFid = "ring" + useId().replace(/:/g, "");
  const [reduceMotion] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  const stepIdx = Math.min(LOADING_STEPS.length - 1, Math.floor((progress / 0.92) * LOADING_STEPS.length));
  const pct = Math.round(progress * 100);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(20,15,12,0.72)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 24, animation: "fadeIn 0.2s backwards" }}>
      <div style={{ width: "100%", maxWidth: 340, background: "var(--surface)", borderRadius: 24, padding: "34px 26px 28px", textAlign: "center", boxShadow: "0 24px 70px rgba(0,0,0,0.45)" }}>
        {/* Cocotte croquée « à l'encre » (même trait fait main que les états vides,
            avec ses volutes de vapeur : « on mijote ») au centre d'un anneau de
            progression qui se remplit et « bout » légèrement. */}
        <div style={{ position: "relative", width: 116, height: 116, margin: "0 auto 18px" }}>
          {/* `pathLength="100"` → dash/offset raisonnent en POURCENTAGE, indépendamment
              du rayon (aucun calcul de circonférence à faire, aucun décalage possible).
              Rotation de -90° portée par un attribut SVG (origine explicite 58,58) pour
              démarrer l'arc en haut, la version CSS `transform` sur le <svg> souffrait
              d'une origine de transformation ambiguë selon le navigateur. Le filtre
              d'encre ondule les deux tracés d'une même houle → cercle dessiné à la main. */}
          <svg width="116" height="116" viewBox="0 0 116 116" aria-hidden="true">
            <defs>
              <filter id={ringFid} x="-25%" y="-25%" width="150%" height="150%">
                <feTurbulence type="fractalNoise" baseFrequency="0.017" numOctaves="2" seed="7" result="noise">
                  {!reduceMotion && <animate attributeName="seed" values="7;15;3;11;7" dur="0.68s" repeatCount="indefinite" calcMode="discrete" />}
                </feTurbulence>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <g filter={`url(#${ringFid})`}>
              <circle cx="58" cy="58" r={RING_R} fill="none" stroke="var(--surface3)" strokeWidth="6" />
              <circle cx="58" cy="58" r={RING_R} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
                pathLength="100" strokeDasharray="100" strokeDashoffset="100"
                transform="rotate(-90 58 58)"
                style={{ animation: `ringFill ${dur}ms cubic-bezier(0.215,0.61,0.355,1) forwards` }} />
            </g>
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <EmptyArt name="casserole" size={84} />
          </div>
        </div>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>On mijote ta recette…</h3>
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
