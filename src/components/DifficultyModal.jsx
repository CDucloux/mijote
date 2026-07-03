import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { DIFFICULTY_LABEL, difficultyColor } from "../lib/difficulty.js";

// ─── EXPLICATION DE LA DIFFICULTÉ ─────────────────────────────────────────────
// Rend transparent le calcul du badge : d'où vient le niveau (geste dominant +
// modificateurs). `data` provient de explainDifficulty().
export function DifficultyModal({ data, onClose }) {
  if (!data) return null;
  const color = difficultyColor(data.score);
  const label = DIFFICULTY_LABEL[data.score];

  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "90dvh" }}>
      {/* Header – niveau + pastilles */}
      <div style={{
        margin: "-20px -20px 4px", padding: "26px 22px 22px",
        background: `linear-gradient(135deg, ${color === "var(--green)" ? "rgba(76,175,125,0.16)" : color === "var(--red)" ? "rgba(224,82,82,0.16)" : "rgba(232,146,10,0.16)"}, transparent)`,
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <span style={{
            width: 48, height: 48, borderRadius: 16, flexShrink: 0,
            background: "var(--surface2)", border: `1px solid ${color}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
          }}>
            <span style={{ display: "inline-flex", gap: 2 }}>
              {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i <= data.score ? color : "var(--surface3)" }} />)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{data.score}/5</span>
          </span>
          <div>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text)" }}>{label}</div>
            <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 2 }}>Comment ce niveau est calculé</div>
          </div>
        </div>
      </div>

      <div style={{ overflowY: "auto", maxHeight: "64vh", padding: "18px 2px 4px" }}>
        {data.overridden ? (
          <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.65, margin: 0 }}>
            Cette difficulté a été <strong style={{ color: "var(--text)" }}>définie manuellement</strong> par l'auteur de la recette. Elle ne dépend donc pas du calcul automatique.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 14.5, color: "var(--text2)", lineHeight: 1.6, margin: "0 0 22px" }}>
              Mijoté repère les <strong style={{ color: "var(--text)" }}>gestes techniques</strong> dans les étapes{data.inheritedFromBases ? " de la recette et de ses préparations de base" : ""} et retient le plus exigeant, puis ajoute des points selon la charge de travail.
            </p>

            {/* Geste dominant */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Point de départ</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)", marginBottom: 22 }}>
              <span style={{ display: "inline-flex", gap: 2, flexShrink: 0 }}>
                {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= data.base ? difficultyColor(data.base) : "var(--surface3)" }} />)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Geste le plus difficile : niveau {data.base}</div>
                <div style={{ fontSize: 13, color: "var(--text2)", marginTop: 2 }}>{data.drivers.join(", ")}</div>
              </div>
            </div>

            {/* Modificateurs */}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Points supplémentaires</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: data.techniques.length ? 22 : 4 }}>
              {data.mods.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 12, background: m.applied ? "rgba(232,112,58,0.09)" : "var(--surface2)", border: `1px solid ${m.applied ? "rgba(232,112,58,0.28)" : "var(--border)"}`, opacity: m.applied ? 1 : 0.72 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: m.applied ? "var(--accent)" : "var(--surface3)", color: m.applied ? "#fff" : "var(--text3)" }}>{m.applied ? "+1" : "–"}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>{m.detail}</div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12.5, color: "var(--text3)", padding: "2px 2px 0", lineHeight: 1.5 }}>
                Niveau {data.base} + {data.modsApplied} point{data.modsApplied > 1 ? "s" : ""} = <strong style={{ color: "var(--text2)" }}>{data.score}/5</strong>{data.modsCapped ? " (bonus plafonné à +2)" : ""}.
              </div>
            </div>

            {/* Gestes détectés */}
            {data.techniques.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Gestes détectés ({data.techniques.length})</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                  {data.techniques.map(t => (
                    <span key={t.id} title={t.inherited ? "Hérité d'une préparation de base" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20, fontSize: 12.5, fontWeight: 500, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                      <span style={{ display: "inline-flex", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: i <= t.difficulty ? difficultyColor(t.difficulty) : "var(--surface3)" }} />)}
                      </span>
                      {t.name}
                      {t.inherited && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>· base</span>}
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </SwipeableSheet>
  );
}
