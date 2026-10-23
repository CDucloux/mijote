import { currentMonth } from "@/lib/food/seasonality.js";

// ─── FRISE DE SAISON « seasonality bar » ─────────────────────────────────────
// Barre continue : les mois de saison forment des segments arrondis remplis sur
// une piste, avec un nœud « ce mois-ci » posé sur la timeline, et les initiales
// des mois dessous. Aplat d'une seule couleur, sans dégradé ni halo : la saison
// se lit à la forme des segments, pas à un effet. Couleur paramétrable (accent
// dans la fiche ingrédient, ambre dans « L'ingrédient du moment »).
const MONTHS_INI = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/**
 * @param months - Numéros de mois de saison (1–12).
 * @param color - Couleur des segments et des mois de saison (défaut accent).
 * @param node - Couleur de l'anneau du nœud « ce mois-ci ».
 * @param trackHeight - Épaisseur de la piste (px).
 * @param onToggle - Si fourni, la frise devient ÉDITABLE : chaque mois est un bouton
 *   qui appelle `onToggle(mois)` ; la piste reflète la sélection en direct.
 */
interface SeasonBarProps {
  months?: number[];
  color?: string;
  node?: string;
  trackHeight?: number;
  onToggle?: (month: number) => void;
}

export function SeasonBar({ months, color = "var(--accent)", node = "var(--accent-deep, #b8461c)", trackHeight = 12, onToggle }: SeasonBarProps) {
  const on = new Set(months || []);
  const now = currentMonth();
  const pct = (n: number) => `${(n / 12) * 100}%`;
  // Regroupe les mois de saison en segments contigus (1–12, sans repli d'année).
  const runs: [number, number][] = [];
  [...on].sort((a, b) => a - b).forEach(m => {
    const last = runs[runs.length - 1];
    if (last && m === last[1] + 1) last[1] = m;
    else runs.push([m, m]);
  });
  return (
    <div>
      <div style={{ position: "relative", height: trackHeight, borderRadius: 999, background: "var(--surface2)" }}>
        {runs.map(([s, e], i) => (
          <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: pct(s - 1), width: pct(e - s + 1), borderRadius: 999, background: color }} />
        ))}
        <span aria-hidden="true" title="Ce mois-ci" style={{ position: "absolute", top: "50%", left: pct(now - 0.5), transform: "translate(-50%,-50%)", width: trackHeight + 3, height: trackHeight + 3, borderRadius: "50%", background: "var(--surface)", border: `2.5px solid ${node}`, boxShadow: "0 1px 3px rgba(0,0,0,0.2)", zIndex: 2 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", marginTop: onToggle ? 6 : 8, gap: onToggle ? 3 : 0 }}>
        {MONTHS_INI.map((m, i) => {
          const month = i + 1, active = on.has(month), isNow = month === now;
          const tone = isNow && !onToggle ? node : active ? color : "var(--text3)";
          if (onToggle) {
            return (
              <button key={i} onClick={() => onToggle(month)} title="Marquer / retirer ce mois"
                className={`ripple ${active ? "hover-deepen" : "hover-neutral"}`}
                style={{ padding: "6px 0", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: active ? color : "var(--surface2)", color: active ? "#fff" : "var(--text3)",
                  border: "none", transition: "background 0.12s, color 0.12s" }}>{m}</button>
            );
          }
          return <span key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: active || isNow ? 700 : 500, color: tone }}>{m}</span>;
        })}
      </div>
    </div>
  );
}
