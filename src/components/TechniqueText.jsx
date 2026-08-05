import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
const POP_MAX_W = 300;   // largeur maximale de la bulle

export function TechniqueText({ text, index: indexProp }) {
  const { techniques } = useAppShell();
  const builtIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);
  const index = indexProp || builtIndex;
  // On retire les tirets cadratins « — » (marqueur des textes IA) avant tout.
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
          <div className="tech-pop" role="tooltip" style={{ transformOrigin: pop.above ? "bottom left" : "top left" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>{pop.tech.name}</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {TECHNIQUE_CATEGORIES[pop.tech.category] || pop.tech.category}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5 }}>{pop.tech.definition}</div>
            {pop.tech.source && <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 7 }}>{pop.tech.source}</div>}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
