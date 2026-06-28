import { useState, useMemo } from "react";
import { useAppShell } from "../context/AppShellContext.jsx";
import { buildTechniqueIndex, annotateText } from "../lib/techniques.js";
import { TECHNIQUE_CATEGORIES } from "../lib/dataYaml.js";

// ─── TEXTE AVEC TECHNIQUES SURLIGNÉES ─────────────────────────────────────────
// Rend un texte d'étape en repérant les gestes du glossaire (suer, déglacer…) et
// en affichant leur définition au survol (desktop) ou au tap (mobile). Le
// glossaire vient du contexte (masterDB.techniques) ; sans glossaire, le texte
// est rendu tel quel.

const wordBtn = (active) => ({
  display: "inline", padding: 0, margin: 0, font: "inherit", color: "var(--accent)",
  background: active ? "rgba(232,112,58,0.14)" : "transparent",
  border: "none", borderBottom: "1.5px dotted var(--accent)", borderRadius: 3,
  cursor: "help", lineHeight: "inherit", textAlign: "left",
});

const popover = {
  position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 60,
  width: "max-content", maxWidth: "min(280px, 80vw)",
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)", padding: "11px 13px",
  textAlign: "left", cursor: "default", whiteSpace: "normal",
};

export function TechniqueText({ text, index: indexProp }) {
  const { techniques } = useAppShell();
  const builtIndex = useMemo(() => buildTechniqueIndex(techniques), [techniques]);
  const index = indexProp || builtIndex;
  const segments = useMemo(() => annotateText(text, index), [text, index]);
  const [openId, setOpenId] = useState(null);   // épinglé au tap (mobile)
  const [hoverId, setHoverId] = useState(null);  // au survol (desktop)

  // Rien à surligner → on rend le texte brut.
  if (segments.length === 1 && !segments[0].tech) return text;

  return segments.map((seg, i) => {
    if (!seg.tech) return <span key={i}>{seg.text}</span>;
    const key = String(i);
    const t = seg.tech;
    const active = openId === key || hoverId === key;
    return (
      <span key={i} style={{ position: "relative", display: "inline-block" }}>
        <button
          type="button"
          title={`${t.name} — voir la définition`}
          onClick={() => setOpenId(openId === key ? null : key)}
          onMouseEnter={() => setHoverId(key)}
          onMouseLeave={() => setHoverId(null)}
          style={wordBtn(active)}
        >
          {seg.text}
        </button>
        {active && (
          <span role="tooltip" style={popover} onClick={e => e.stopPropagation()}>
            <span style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{t.name}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {TECHNIQUE_CATEGORIES[t.category] || t.category}
              </span>
            </span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5 }}>{t.definition}</span>
            {t.source && <span style={{ display: "block", fontSize: 10.5, color: "var(--text3)", marginTop: 6 }}>{t.source}</span>}
          </span>
        )}
      </span>
    );
  });
}
