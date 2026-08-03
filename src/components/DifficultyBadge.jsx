import { DIFFICULTY_LABEL, difficultyColor } from "@/lib/recipes/difficulty.js";

// ─── BADGE DE DIFFICULTÉ ──────────────────────────────────────────────────────
// Chip « pastilles + libellé » (Très facile → Expert). `onImage` : variante claire
// pour poser sur le hero. Ne rend rien si aucun score (recette sans geste noté).
export function DifficultyBadge({ score, onImage = false, title, onClick }) {
  if (!score) return null;
  const color = difficultyColor(score);
  const empty = onImage ? "rgba(255,255,255,0.28)" : "var(--surface3)";
  const Tag = onClick ? "button" : "span";
  return (
    <Tag className="tag" onClick={onClick} title={title || `Difficulté ${score}/5 · ${DIFFICULTY_LABEL[score]}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600,
        ...(onClick ? { cursor: "pointer" } : {}),
        ...(onImage
          ? { color: "rgba(255,255,255,0.92)", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)" }
          : { color: "var(--text2)", background: "var(--surface2)", border: "1px solid var(--border)" }),
      }}>
      <span style={{ display: "inline-flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: i <= score ? color : empty }} />)}
      </span>
      {DIFFICULTY_LABEL[score]}
    </Tag>
  );
}
