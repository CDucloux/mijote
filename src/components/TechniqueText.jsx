import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { buildTechniqueIndex, annotateText } from "@/lib/recipes/techniques.js";
import { TECHNIQUE_CATEGORIES } from "@/lib/household/dataYaml.js";
import { stripAiDashes } from "@/lib/format.js";

// ─── TEXTE AVEC TECHNIQUES SURLIGNÉES ─────────────────────────────────────────
// Rend un texte d'étape en repérant les gestes du glossaire (suer, déglacer…) et
// en affichant leur définition au survol (desktop) ou au tap (mobile). Le
// glossaire vient du contexte (masterDB.techniques) ; sans glossaire, le texte
// est rendu tel quel.
//
// La bulle est portée dans <body> et positionnée en `fixed` à partir du rect du
// mot, BORNÉE au viewport (plus de débordement / texte coupé sur mobile). Elle
// apparaît avec un léger fondu (voir keyframe `techPop`).

// Surlignage « marqueur » discret : fond accent translucide, coins arrondis, pas
// de soulignage. Lisible et clairement tactile (donc utilisable au tap sur mobile).
const wordBtn = (active) => ({
  display: "inline", padding: "1px 4px", margin: "0 -1px", font: "inherit",
  color: "var(--accent)", fontWeight: 600,
  background: active ? "rgba(232,112,58,0.28)" : "rgba(232,112,58,0.11)",
  border: "none", borderRadius: 6, cursor: "pointer",
  lineHeight: "inherit", textAlign: "left",
  WebkitBoxDecorationBreak: "clone", boxDecorationBreak: "clone",
  transition: "background 0.15s ease",
});

const POP_MARGIN = 10;   // marge minimale avec les bords de l'écran
const POP_MAX_W = 306;   // largeur maximale de la bulle

// Identité visuelle par catégorie de technique : pastille emoji + couleur.
const TECH_CAT = {
  decoupe: { emoji: "🔪", color: "#e0894a" },
  cuisson: { emoji: "🔥", color: "#e0524f" },
  liaison: { emoji: "🥣", color: "#c8951f" },
  preparation: { emoji: "🧑‍🍳", color: "#5b9cf6" },
  dressage: { emoji: "🍽️", color: "#9b87f5" },
};
const techCat = (c) => TECH_CAT[c] || { emoji: "🍳", color: "var(--accent)" };

export function TechniqueText({ text, index: indexProp }) {
  const { techniques } = useAppShell();
  const builtIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);
  const index = indexProp || builtIndex;
  // On retire les tirets cadratins (marqueur des textes IA) avant tout.
  const clean = useMemo(() => stripAiDashes(text), [text]);
  const segments = useMemo(() => annotateText(clean, index), [clean, index]);
  // Bulle affichée : { key, tech, left, top, width, above } ou null.
  const [pop, setPop] = useState(null);
  const [pinned, setPinned] = useState(false); // épinglée au tap (mobile)

  // Calcule la position `fixed` de la bulle à partir du rect du mot, bornée au
  // viewport (horizontalement) et retournée au-dessus si peu de place en bas.
  const placeFor = useCallback((el, key, tech) => {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = Math.min(POP_MAX_W, vw - POP_MARGIN * 2);
    const left = Math.max(POP_MARGIN, Math.min(r.left, vw - width - POP_MARGIN));
    const above = (vh - r.bottom) < 180 && r.top > 180;
    const top = above ? r.top - 6 : r.bottom + 6;
    return { key, tech, left, top, width, above };
  }, []);

  // Ferme au clic ailleurs OU au scroll (les coordonnées `fixed` deviennent
  // caduques quand le contenu défile).
  useEffect(() => {
    if (!pop) return;
    const close = () => { setPop(null); setPinned(false); };
    document.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pop]);

  // Rien à surligner → on rend le texte (nettoyé) brut.
  if (segments.length === 1 && !segments[0].tech) return clean;

  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.tech) return <span key={i}>{seg.text}</span>;
        const key = String(i);
        const t = seg.tech;
        const active = pop?.key === key;
        return (
          <button key={i} type="button"
            title={`${t.name} : voir la définition`}
            onClick={e => { e.stopPropagation(); if (active && pinned) { setPop(null); setPinned(false); } else { setPop(placeFor(e.currentTarget, key, t)); setPinned(true); } }}
            onMouseEnter={e => { if (!pinned) setPop(placeFor(e.currentTarget, key, t)); }}
            onMouseLeave={() => { if (!pinned) setPop(null); }}
            style={wordBtn(active)}>
            {seg.text}
          </button>
        );
      })}
      {pop && createPortal(
        <div style={{ position: "fixed", left: pop.left, top: pop.top, width: pop.width, zIndex: 500, transform: pop.above ? "translateY(-100%)" : "none", pointerEvents: pinned ? "auto" : "none" }}
          onClick={e => e.stopPropagation()}>
          {(() => {
            const c = techCat(pop.tech.category);
            const catLabel = TECHNIQUE_CATEGORIES[pop.tech.category] || pop.tech.category;
            const diff = Number(pop.tech.difficulty) || 0;
            return (
              <div className="tech-pop" role="tooltip" style={{ transformOrigin: pop.above ? "bottom left" : "top left" }}>
                {/* barre d'accent colorée en tête, selon la catégorie */}
                <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "14px 14px 0 0", background: c.color }} />
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 20, background: `color-mix(in srgb, ${c.color} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${c.color} 32%, transparent)` }}>{c.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{pop.tech.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: c.color, background: `color-mix(in srgb, ${c.color} 14%, transparent)`, padding: "2px 8px", borderRadius: 999 }}>{catLabel}</span>
                      {diff > 0 && (
                        <span title={`Difficulté ${diff}/5`} style={{ display: "inline-flex", gap: 2.5, alignItems: "center" }}>
                          {[1, 2, 3, 4, 5].map(i => (
                            <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i <= diff ? c.color : "var(--surface3)" }} />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.55 }}>{pop.tech.definition}</div>
                {pop.tech.source && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text3)", marginTop: 9, paddingTop: 9, borderTop: "1px solid var(--border)" }}>
                    <Icon name="book" size={11} color="var(--text3)" /> {pop.tech.source}
                  </div>
                )}
              </div>
            );
          })()}
        </div>,
        document.body
      )}
    </>
  );
}
