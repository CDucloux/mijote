import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { AdminBadge } from "./AdminBadge.jsx";

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

/**
 * Compteur de quota d'import IA (reliquat jour + mois) pour les abonnés Mijoté+.
 * Purement INDICATIF : l'autorité reste le serveur. Deux jauges compactes (jour /
 * mois) avec un liseré rouge quand la limite est atteinte. L'admin voit « Illimité ».
 *
 * @param label - Libellé du type (« depuis un lien », « photo »).
 * @param rem - Reliquat renvoyé par `remainingFor` (dayUsed/dayLimit/monthUsed/monthLimit/blocked).
 * @param unlimited - `true` pour l'admin (illimité).
 */
export function QuotaMeter({ label, rem, unlimited }) {
  if (unlimited) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 14, background: "rgba(139,111,240,0.09)", border: "1px solid rgba(139,111,240,0.28)" }}>
        <AdminBadge />
        <span style={{ fontSize: 12.5, color: "var(--text2)", fontWeight: 600 }}>Imports {label} <strong style={{ color: "#8b6ff0" }}>illimités</strong> — les quotas ne s'appliquent pas.</span>
      </div>
    );
  }
  if (!rem) return null;

  // La jauge représente ce qui RESTE (et non ce qui est consommé) : un quota
  // quasi-intact affiche une barre quasi-pleine — cohérent avec « Imports restants »,
  // et on évite l'effet « barre presque toute grise » qui semblait négatif.
  const Gauge = ({ tag, left, limit }) => {
    const frac = limit ? Math.max(0, Math.min(1, left / limit)) : 0;
    const out = left === 0;
    const low = !out && frac <= 0.2;
    const color = out ? "var(--red)" : low ? "#e8920a" : "var(--accent)";
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 10.5, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{tag}</span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color }}>{left}<span style={{ color: "var(--text3)", fontWeight: 500 }}> / {limit}</span></span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "var(--surface3)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${frac * 100}%`, borderRadius: 999, background: color, transition: "width 0.3s ease" }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "13px 15px", borderRadius: 16, background: "var(--surface)", border: `1px solid ${rem.blocked ? "rgba(224,82,82,0.35)" : "var(--border)"}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <Icon name={rem.blocked ? "warning" : "sparkle"} size={13} color={rem.blocked ? "var(--red)" : "var(--accent)"} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: rem.blocked ? "var(--red)" : "var(--text2)" }}>
          {rem.blocked ? "Limite atteinte" : "Imports restants"}
        </span>
        {/* Type d'import en pastille (pas de séparateur « · ») */}
        <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 600, color: "var(--text3)", background: "var(--surface2)", borderRadius: 20, padding: "2px 9px" }}>{label}</span>
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <Gauge tag="Aujourd'hui" left={rem.dayLeft} limit={rem.dayLimit} />
        <Gauge tag="Ce mois-ci" left={rem.monthLeft} limit={rem.monthLimit} />
      </div>
    </div>
  );
}

/** En-tête de page d'import : bouton retour + titre. L'icône identitaire vit dans
 * le bloc d'intro (une seule occurrence) — pas de répétition ici. */
export function ImportHeader({ title, onBack }) {
  return (
    <div style={{ padding: "18px 20px 14px", flexShrink: 0, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={onBack} aria-label="Retour" className="import-back" style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}>
        <Icon name="back" size={17} />
      </button>
      <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", margin: 0 }}>{title}</h1>
    </div>
  );
}
