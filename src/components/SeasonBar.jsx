import { currentMonth } from "@/lib/food/seasonality.js";

// ─── FRISE DE SAISON « seasonality bar » ─────────────────────────────────────
// Barre continue : les mois de saison forment des segments arrondis remplis sur
// une piste, avec un nœud « ce mois-ci » posé sur la timeline, et les initiales
// des mois dessous. Couleurs paramétrables pour s'accorder au contexte (accent
// dans « L'ingrédient du moment », vert dans la fiche ingrédient).
const MONTHS_INI = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * @param months - Numéros de mois de saison (1–12).
 * @param from - Couleur de début des segments (défaut accent).
 * @param to - Couleur de fin du dégradé des segments.
 * @param node - Couleur de l'anneau du nœud « ce mois-ci ».
 * @param trackHeight - Épaisseur de la piste (px).
 */
export function SeasonBar({ months, from = "var(--accent)", to = "#f2a25f", node = "var(--accent-deep, #b8461c)", trackHeight = 12 }) {
  const on = new Set(months || []);
  const now = currentMonth();
  const pct = (n) => `${(n / 12) * 100}%`;
  // Regroupe les mois de saison en segments contigus (1–12, sans repli d'année).
  const runs = [];
  [...on].sort((a, b) => a - b).forEach(m => {
    const last = runs[runs.length - 1];
    if (last && m === last[1] + 1) last[1] = m;
    else runs.push([m, m]);
  });
  return (
    <div>
      <div style={{ position: "relative", height: trackHeight, borderRadius: 999, background: "var(--surface2)", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)" }}>
        {runs.map(([s, e], i) => (
          <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: pct(s - 1), width: pct(e - s + 1), borderRadius: 999, background: `linear-gradient(90deg, ${from}, ${to})`, boxShadow: `0 2px 9px -2px ${from === "var(--green)" ? "rgba(76,175,125,0.6)" : "rgba(232,112,58,0.6)"}` }} />
        ))}
        <span aria-hidden="true" title="Ce mois-ci" style={{ position: "absolute", top: "50%", left: pct(now - 0.5), transform: "translate(-50%,-50%)", width: trackHeight + 3, height: trackHeight + 3, borderRadius: "50%", background: "var(--surface)", border: `2.5px solid ${node}`, boxShadow: "0 2px 7px rgba(60,50,30,0.3)", zIndex: 2 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", marginTop: 8 }}>
        {MONTHS_INI.map((m, i) => {
          const month = i + 1, active = on.has(month), isNow = month === now;
          return (
            <span key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: active || isNow ? 700 : 500, color: isNow ? node : active ? from : "var(--text3)" }}>{m}</span>
          );
        })}
      </div>
    </div>
  );
}
