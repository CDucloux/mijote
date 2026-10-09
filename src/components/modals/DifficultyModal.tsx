import type { ReactNode } from "react";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { Icon } from "../ui/Icon.jsx";
import { capitalize } from "../../lib/format.js";
import { DIFFICULTY_LABEL, difficultyColor, type DifficultyExplain, type Workload } from "@/lib/recipes/difficulty.js";

// ─── EXPLICATION DE LA DIFFICULTÉ ─────────────────────────────────────────────
// Rend le calcul du badge lisible comme un ticket de cuisine : la note en grand,
// puis les lignes qui la composent (geste dominant, points de charge) et le total
// sous un filet pointillé. Pas de cartes : l'alignement et la typo font la structure.
// `data` provient de explainDifficulty().

// Jauge fine en 5 segments : traduit la note, ne décore pas.
function Gauge({ level, color }: { level: number; color: string }) {
  return (
    <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= level ? color : "var(--surface3)" }} />
      ))}
    </div>
  );
}

// Ligne du ticket : intitulé + précision à gauche, valeur alignée à droite.
function LedgerRow({ title, hint, value, muted = false }: { title: ReactNode; hint?: ReactNode; value: ReactNode; muted?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "11px 0" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: muted ? "var(--text3)" : "var(--text)", lineHeight: 1.35 }}>{title}</div>
        {hint && <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 2, lineHeight: 1.4 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0, fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: muted ? "var(--text3)" : "var(--text)" }}>{value}</div>
    </div>
  );
}

const HEADING = { fontSize: 13, fontWeight: 650, color: "var(--text2)", margin: "0 0 4px" } as const;

interface DifficultyModalProps {
  data?: DifficultyExplain | null;
  /** Charge de travail, montrée à part : elle n'entre pas dans la note. */
  workload?: Workload | null;
  onClose: () => void;
}

export function DifficultyModal({ data, workload, onClose }: DifficultyModalProps) {
  if (!data || data.score == null) return null;
  const color = difficultyColor(data.score);

  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "90dvh" }}>
      {/* Note : l'élément dominant de la feuille. */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, margin: "4px 2px 14px" }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500, marginBottom: 4 }}>Difficulté</div>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)", lineHeight: 1 }}>{DIFFICULTY_LABEL[data.score]}</div>
        </div>
        <div style={{ fontFamily: "var(--ff-display)", fontWeight: 700, color, lineHeight: 0.9, fontVariantNumeric: "tabular-nums" }}>
          <span style={{ fontSize: 46 }}>{data.score}</span>
          <span style={{ fontSize: 20, color: "var(--text3)" }}>/5</span>
        </div>
      </div>
      <Gauge level={data.score} color={color} />

      {data.overridden ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 22 }}>
          <Icon name="edit" size={17} color="var(--text3)" style={{ marginTop: 2, flexShrink: 0 }} />
          <p style={{ fontSize: 14.5, color: "var(--text2)", lineHeight: 1.6, margin: 0, maxWidth: "60ch" }}>
            Cette difficulté a été fixée à la main dans la recette : elle ne vient pas du calcul automatique.
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 14.5, color: "var(--text2)", lineHeight: 1.6, margin: "20px 2px 26px", maxWidth: "60ch" }}>
            Le geste le plus technique des étapes{data.inheritedFromBases ? " (préparations de base comprises)" : ""} fixe le niveau de départ. La variété des gestes techniques ou une préparation de base ajoutent au plus un point, et seul un geste de niveau 4 ou plus mène à « Expert ».
          </p>

          {/* Le ticket : chaque ligne qui compose la note, puis le total. */}
          <div style={HEADING}>Le calcul</div>
          <LedgerRow title={data.drivers.join(", ")} hint="Geste le plus exigeant" value={`niveau ${data.base}`} />
          {data.mods.map((m, i) => (
            <LedgerRow key={i} muted={!m.applied} title={capitalize(m.detail)}
              hint={`Un point si ${m.label.charAt(0).toLowerCase()}${m.label.slice(1)}`}
              value={m.applied ? "+1" : "+0"} />
          ))}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, marginTop: 6, paddingTop: 14, borderTop: "1.5px dashed var(--border)" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Total</div>
              {data.modsCapped && <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 2 }}>Un seul point de bonus retenu</div>}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{data.score}/5</div>
          </div>

          {/* Gestes repérés : les pastilles traduisent le niveau propre à chaque geste. */}
          {data.techniques.length > 0 && (
            <div style={{ marginTop: 30 }}>
              <div style={{ ...HEADING, marginBottom: 10 }}>{data.techniques.length} geste{data.techniques.length > 1 ? "s" : ""} repéré{data.techniques.length > 1 ? "s" : ""} dans les étapes</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {data.techniques.map(tech => (
                  <span key={tech.id} title={tech.inherited ? "Vient d'une préparation de base" : undefined}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 500, background: "var(--surface2)", color: "var(--text)" }}>
                    <span style={{ display: "inline-flex", gap: 2 }} aria-label={`niveau ${tech.difficulty ?? 0}`}>
                      {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: i <= (tech.difficulty ?? 0) ? difficultyColor(tech.difficulty ?? 0) : "var(--surface3)" }} />)}
                    </span>
                    {tech.name}
                    {tech.inherited && <span style={{ fontSize: 11.5, color: "var(--text3)" }}>base</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Charge de travail : la longueur de la recette, comptée à part de la note. */}
      {workload && (
        <div style={{ marginTop: 30 }}>
          <div style={HEADING}>Charge de travail</div>
          <LedgerRow title={workload.label} hint="Le nombre d'étapes, compté à part : une recette longue n'est pas plus technique." value={`${workload.steps} étape${workload.steps > 1 ? "s" : ""}`} />
        </div>
      )}
    </SwipeableSheet>
  );
}
