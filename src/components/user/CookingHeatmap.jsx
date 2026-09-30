import { useMemo } from "react";
import { buildHeatmap } from "@/lib/planning/cookingActivity.js";

// ─── HEATMAP D'ACTIVITÉ CUISINE (façon GitHub) ───────────────────────────────
// Colonnes = semaines (lundi→dimanche), teinte selon le nombre de repas du jour.
// Theme-aware : cases vides en surface2, niveaux 1-4 en accent de plus en plus dense.

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DOW = ["Lun", "", "Mer", "", "Ven", "", "Dim"];
const CELL = 12, GAP = 3;
const LEVEL_COLOR = ["var(--surface2)", "rgba(var(--accent-rgb),0.30)", "rgba(var(--accent-rgb),0.52)", "rgba(var(--accent-rgb),0.76)", "var(--accent)"];

function Legend() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--text3)" }}>
      Moins
      {[0, 1, 2, 3, 4].map(l => <span key={l} style={{ width: 11, height: 11, borderRadius: 3, background: LEVEL_COLOR[l], border: "1px solid var(--border)" }} />)}
      Plus
    </div>
  );
}

export function CookingHeatmap({ mealPlan = {}, weeks = 26 }) {
  const data = useMemo(() => buildHeatmap(mealPlan, { weeks }), [mealPlan, weeks]);

  // Étiquettes de mois : au-dessus de la 1re colonne où le mois change.
  const monthLabels = data.cols.map((col, i) => {
    const first = col.find(d => !d.future) || col[0];
    const m = first.date.getMonth();
    const prev = i > 0 ? (data.cols[i - 1].find(d => !d.future) || data.cols[i - 1][0]).date.getMonth() : -1;
    return m !== prev ? MONTHS[m] : "";
  });

  const fmtDay = (d) => d.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
          {/* Étiquettes de mois */}
          <div style={{ display: "flex", marginLeft: 26 }}>
            {monthLabels.map((lbl, i) => (
              <div key={i} style={{ width: CELL + GAP, fontSize: 9.5, color: "var(--text3)", whiteSpace: "nowrap" }}>{lbl}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: GAP }}>
            {/* Jours de la semaine */}
            <div style={{ display: "flex", flexDirection: "column", gap: GAP, marginRight: 4, width: 22 }}>
              {DOW.map((d, i) => <div key={i} style={{ height: CELL, fontSize: 9, lineHeight: `${CELL}px`, color: "var(--text3)" }}>{d}</div>)}
            </div>
            {/* Colonnes de semaines */}
            {data.cols.map((col, ci) => (
              <div key={ci} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                {col.map((day, di) => (
                  <div key={di} title={day.future ? undefined : `${day.count} repas · ${fmtDay(day)}`}
                    style={{ width: CELL, height: CELL, borderRadius: 3, background: day.future ? "transparent" : LEVEL_COLOR[day.level], border: day.future ? "none" : "1px solid var(--border)" }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}><Legend /></div>
    </div>
  );
}

// Statistiques compactes dérivées de la même source (pour l'en-tête du profil).
export function useCookingStats(mealPlan, weeks = 26) {
  return useMemo(() => buildHeatmap(mealPlan, { weeks }), [mealPlan, weeks]);
}
