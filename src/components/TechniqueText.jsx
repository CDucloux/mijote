import { useState, useMemo, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { SwipeableSheet } from "./SwipeableSheet.jsx";
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
  background: active ? "rgba(var(--accent-rgb),0.28)" : "rgba(var(--accent-rgb),0.11)",
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

const popList = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 };

// ─── FICHE TECHNIQUE DÉTAILLÉE ────────────────────────────────────────────────
// Ouverte depuis la bulle compacte via « Plus de détails ». Reprend tout ce que la
// bulle ne montre plus (résultat attendu + indicateurs, erreurs fréquentes, ne pas
// confondre avec), dans une feuille lisible et aérée (tiroir mobile / carte desktop).
const RED = "var(--red, #d1544f)";
const sheetLabel = (color) => ({ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: color || "var(--text3)", marginBottom: 9 });
const sheetItem = { fontSize: 13.5, lineHeight: 1.55, color: "var(--text2)", display: "flex", gap: 9 };
const sheetDot = (color) => ({ width: 5, height: 5, borderRadius: "50%", background: color, marginTop: 8, flexShrink: 0 });

function SheetSection({ label, color, children }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={sheetLabel(color)}>{label}</div>
      {children}
    </section>
  );
}

function TechniqueDetailSheet({ tech, techById, onClose }) {
  const c = techCat(tech.category);
  const catLabel = TECHNIQUE_CATEGORIES[tech.category] || tech.category;
  const diff = Number(tech.difficulty) || 0;
  const er = tech.expected_result || null;
  const inds = Array.isArray(er?.observable_indicators) ? er.observable_indicators : [];
  const errs = Array.isArray(tech.common_errors) ? tech.common_errors : [];
  const conf = Array.isArray(tech.not_to_be_confused_with) ? tech.not_to_be_confused_with : [];
  const parentName = tech.hierarchy?.parent ? techById.get(tech.hierarchy.parent)?.name : null;
  return (
    <SwipeableSheet onClose={onClose} zIndex={760} style={{ maxHeight: "88dvh" }}>
      {(close) => (
        <div>
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 52, height: 52, borderRadius: 16, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 27, background: `color-mix(in srgb, ${c.color} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${c.color} 32%, transparent)` }}>{c.emoji}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ margin: 0, fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.1, color: "var(--text)" }}>{tech.name}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7 }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: c.color, background: `color-mix(in srgb, ${c.color} 14%, transparent)`, padding: "3px 10px", borderRadius: 999 }}>{catLabel}</span>
                {diff > 0 && (
                  <span title={`Difficulté ${diff}/5`} style={{ display: "inline-flex", gap: 3, alignItems: "center" }}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= diff ? c.color : "var(--surface3)" }} />
                    ))}
                  </span>
                )}
              </div>
            </div>
            <button type="button" onClick={() => close()} aria-label="Fermer" className="pressable" style={{ flexShrink: 0, alignSelf: "flex-start", width: 32, height: 32, borderRadius: "50%", border: "none", background: "var(--surface2)", display: "grid", placeItems: "center", cursor: "pointer" }}>
              <Icon name="close" size={16} color="var(--text2)" />
            </button>
          </div>

          <p style={{ margin: "18px 0 0", fontSize: 14.5, lineHeight: 1.6, color: "var(--text)" }}>{tech.definition}</p>
          {parentName && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, color: "var(--text3)", background: "var(--surface2)", padding: "5px 11px", borderRadius: 999 }}>
              Fait partie de <span style={{ fontWeight: 600, color: "var(--text2)" }}>{parentName}</span>
            </div>
          )}

          {er?.summary && (
            <SheetSection label="Résultat attendu" color={c.color}>
              <div style={{ fontSize: 13.5, color: "var(--text2)", lineHeight: 1.55 }}>{er.summary}</div>
              {inds.length > 0 && (
                <ul style={{ ...popList, gap: 7, marginTop: 10 }}>
                  {inds.map((s, k) => (
                    <li key={k} style={sheetItem}><span style={sheetDot(c.color)} /><span>{s}</span></li>
                  ))}
                </ul>
              )}
            </SheetSection>
          )}
          {errs.length > 0 && (
            <SheetSection label="Erreurs fréquentes" color={RED}>
              <ul style={{ ...popList, gap: 7 }}>
                {errs.map((s, k) => (
                  <li key={k} style={sheetItem}><span style={sheetDot(RED)} /><span>{s}</span></li>
                ))}
              </ul>
            </SheetSection>
          )}
          {conf.length > 0 && (
            <SheetSection label="Ne pas confondre avec">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {conf.map((r, k) => (
                  <div key={k} style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 13px" }}>
                    <span style={{ fontWeight: 600, color: "var(--accent)" }}>{techById.get(r.technique_id)?.name || r.technique_id}</span>
                    {r.distinction && <span> {r.distinction}</span>}
                  </div>
                ))}
              </div>
            </SheetSection>
          )}
          {tech.source && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text3)", marginTop: 22, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
              <Icon name="book" size={12} color="var(--text3)" /> {tech.source}
            </div>
          )}
        </div>
      )}
    </SwipeableSheet>
  );
}

export function TechniqueText({ text, index: indexProp }) {
  const { techniques } = useAppShell();
  const techById = useMemo(() => new Map((techniques || []).map(t => [t.id, t])), [techniques]);
  const builtIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);
  const index = indexProp || builtIndex;
  // On retire les tirets cadratins (marqueur des textes IA) avant tout.
  const clean = useMemo(() => stripAiDashes(text), [text]);
  const segments = useMemo(() => annotateText(clean, index), [clean, index]);
  // Bulle affichée : { key, tech, left, top, width, above } ou null.
  const [pop, setPop] = useState(null);
  const [pinned, setPinned] = useState(false); // épinglée au tap (mobile)
  const [detail, setDetail] = useState(null);  // technique dont la fiche détaillée est ouverte

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
            const t = pop.tech;
            const c = techCat(t.category);
            const catLabel = TECHNIQUE_CATEGORIES[t.category] || t.category;
            const diff = Number(t.difficulty) || 0;
            const er = t.expected_result || null;
            const inds = Array.isArray(er?.observable_indicators) ? er.observable_indicators : [];
            const errs = Array.isArray(t.common_errors) ? t.common_errors : [];
            const conf = Array.isArray(t.not_to_be_confused_with) ? t.not_to_be_confused_with : [];
            const parentName = t.hierarchy?.parent ? techById.get(t.hierarchy.parent)?.name : null;
            // La bulle reste volontairement compacte (aperçu) ; tout le détail passe
            // dans la fiche, ouverte à la demande quand il y a matière à montrer.
            const hasMore = Boolean(er?.summary) || inds.length > 0 || errs.length > 0 || conf.length > 0;
            return (
              <div className="tech-pop" role="tooltip" style={{ transformOrigin: pop.above ? "bottom left" : "top left", maxHeight: "min(70vh, 460px)", overflowY: "auto" }}>
                {/* barre d'accent colorée en tête, selon la catégorie */}
                <span style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, borderRadius: "14px 14px 0 0", background: c.color }} />
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 10 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "grid", placeItems: "center", fontSize: 20, background: `color-mix(in srgb, ${c.color} 16%, transparent)`, border: `1px solid color-mix(in srgb, ${c.color} 32%, transparent)` }}>{c.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em", lineHeight: 1.2 }}>{pop.tech.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: c.color, background: `color-mix(in srgb, ${c.color} 14%, transparent)`, padding: "2px 8px", borderRadius: 999 }}>{catLabel}</span>
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
                {parentName && (
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 7 }}>
                    Fait partie de <span style={{ fontWeight: 600, color: "var(--text2)" }}>{parentName}</span>
                  </div>
                )}
                {hasMore && (
                  <button type="button" className="pressable"
                    onClick={e => { e.stopPropagation(); setDetail(t); setPop(null); setPinned(false); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 11, padding: "6px 13px 6px 14px", borderRadius: 999, border: "none", cursor: "pointer", background: `color-mix(in srgb, ${c.color} 13%, transparent)`, color: c.color, fontSize: 11.5, fontWeight: 600 }}>
                    Plus de détails <Icon name="forward" size={13} color={c.color} />
                  </button>
                )}
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
      {detail && <TechniqueDetailSheet tech={detail} techById={techById} onClose={() => setDetail(null)} />}
    </>
  );
}
