import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { DIFFICULTY_LABEL, difficultyColor } from "@/lib/recipes/difficulty.js";
import { Row, Col, IconChip } from "./ui/primitives.jsx";

// ─── EXPLICATION DE LA DIFFICULTÉ ─────────────────────────────────────────────
// Rend transparent le calcul du badge : d'où vient le niveau (geste dominant +
// modificateurs). `data` provient de explainDifficulty().

// Teintes douces dérivées de la couleur de difficulté (vert / ambre / rouge).
function tints(color) {
  if (color === "var(--green)") return { soft: "rgba(76,175,125,0.13)", line: "rgba(76,175,125,0.32)" };
  if (color === "var(--red)") return { soft: "rgba(224,82,82,0.13)", line: "rgba(224,82,82,0.32)" };
  return { soft: "rgba(232,146,10,0.13)", line: "rgba(232,146,10,0.32)" };
}

// Jauge segmentée pleine largeur (5 segments).
function Gauge({ level, color, height = 7 }) {
  return (
    <div style={{ display: "flex", gap: 5 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ flex: 1, height, borderRadius: 999, background: i <= level ? color : "var(--surface3)", transition: "background 0.2s ease" }} />
      ))}
    </div>
  );
}

// Libellé de section (petite étiquette accent).
function SectionLabel({ children }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.11em", margin: "0 2px 11px" }}>{children}</div>;
}

export function DifficultyModal({ data, onClose }) {
  if (!data) return null;
  const color = difficultyColor(data.score);
  const label = DIFFICULTY_LABEL[data.score];
  const t = tints(color);

  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "90dvh" }}>
      {/* ── HERO : niveau + score + jauge (dégagé du handle) ── */}
      <div style={{ borderRadius: 20, padding: "17px 18px 19px", background: `linear-gradient(150deg, ${t.soft}, transparent 88%)`, border: `1px solid ${t.line}`, marginBottom: 22 }}>
        <Row align="flex-start" justify="space-between" gap={12}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.11em", fontWeight: 700, color: "var(--text3)", marginBottom: 6 }}>Niveau de difficulté</div>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 27, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1 }}>{label}</div>
          </div>
          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "baseline", gap: 1, padding: "7px 13px", borderRadius: 999, background: "var(--surface)", border: `1.5px solid ${color}`, color, fontWeight: 800, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>
            {data.score}<span style={{ fontSize: 11, fontWeight: 700, opacity: 0.65 }}>/5</span>
          </span>
        </Row>
        <div style={{ marginTop: 16 }}><Gauge level={data.score} color={color} height={8} /></div>
      </div>

      {data.overridden ? (
        <Row align="stretch" gap={12} style={{ padding: "14px 15px", borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--border)" }}>
          <IconChip size={34} radius={11} tint="rgba(155,135,245,0.14)" style={{ border: "1px solid rgba(155,135,245,0.32)", fontSize: 16 }}>✍️</IconChip>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>
            Cette difficulté a été <strong style={{ color: "var(--text)" }}>définie manuellement</strong> par l'auteur de la recette. Elle ne dépend donc pas du calcul automatique.
          </p>
        </Row>
      ) : (
        <>
          <p style={{ fontSize: 14.5, color: "var(--text2)", lineHeight: 1.6, margin: "0 2px 24px" }}>
            Cardamome repère les <strong style={{ color: "var(--text)" }}>gestes techniques</strong> dans les étapes{data.inheritedFromBases ? " de la recette et de ses préparations de base" : ""} et retient le plus exigeant, puis ajoute des points selon la charge de travail.
          </p>

          {/* ── Geste dominant ── */}
          <SectionLabel>Le geste le plus exigeant</SectionLabel>
          <div style={{ padding: "14px 15px", borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 24 }}>
            <Row justify="space-between" gap={10} style={{ marginBottom: 11 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.drivers.join(", ")}</div>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: difficultyColor(data.base), fontVariantNumeric: "tabular-nums" }}>niveau {data.base}</span>
            </Row>
            <Gauge level={data.base} color={difficultyColor(data.base)} height={6} />
          </div>

          {/* ── Modificateurs ── */}
          <SectionLabel>Points supplémentaires</SectionLabel>
          <Col gap={8}>
            {data.mods.map((m, i) => (
              <Row key={i} gap={12} style={{ padding: "12px 14px", borderRadius: 14, background: m.applied ? "rgba(var(--accent-rgb),0.09)" : "var(--surface2)", border: `1px solid ${m.applied ? "rgba(var(--accent-rgb),0.28)" : "var(--border)"}`, opacity: m.applied ? 1 : 0.68 }}>
                <IconChip size={26} radius={9} tint={m.applied ? "var(--accent)" : "var(--surface3)"} style={{ fontSize: 12.5, fontWeight: 800, color: m.applied ? "#fff" : "var(--text3)" }}>{m.applied ? "+1" : "-"}</IconChip>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>{m.detail}</div>
                </div>
              </Row>
            ))}
          </Col>

          {/* ── Récapitulatif du calcul ── */}
          <Row justify="center" wrap gap={8} style={{ margin: "16px 2px 4px", padding: "12px 14px", borderRadius: 14, background: t.soft, border: `1px solid ${t.line}` }}>
            <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 500 }}>Niveau {data.base}</span>
            <span style={{ fontSize: 13, color: "var(--text3)" }}>+</span>
            <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 500 }}>{data.modsApplied} point{data.modsApplied > 1 ? "s" : ""}</span>
            <span style={{ fontSize: 13, color: "var(--text3)" }}>=</span>
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 1, padding: "3px 10px", borderRadius: 999, background: "var(--surface)", border: `1.5px solid ${color}`, color, fontWeight: 800, fontSize: 13.5, fontVariantNumeric: "tabular-nums" }}>{data.score}<span style={{ fontSize: 10, opacity: 0.65 }}>/5</span></span>
            {data.modsCapped && <span style={{ width: "100%", textAlign: "center", fontSize: 11.5, color: "var(--text3)", marginTop: 2 }}>Bonus plafonné à +2.</span>}
          </Row>

          {/* ── Gestes détectés ── */}
          {data.techniques.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <SectionLabel>Gestes détectés · {data.techniques.length}</SectionLabel>
              <Row wrap align="stretch" gap={7}>
                {data.techniques.map(tech => (
                  <span key={tech.id} title={tech.inherited ? "Hérité d'une préparation de base" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 20, fontSize: 12.5, fontWeight: 500, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    <span style={{ display: "inline-flex", gap: 2 }}>
                      {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: i <= tech.difficulty ? difficultyColor(tech.difficulty) : "var(--surface3)" }} />)}
                    </span>
                    {tech.name}
                    {tech.inherited && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>· base</span>}
                  </span>
                ))}
              </Row>
            </div>
          )}
        </>
      )}
    </SwipeableSheet>
  );
}
