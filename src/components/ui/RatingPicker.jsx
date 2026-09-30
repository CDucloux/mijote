// ─── NOTE (1 à 10) ────────────────────────────────────────────────────────────
// Sélecteur de note réutilisable (carnet d'itérations, fin de cook mode).

export const ratingColor = r => r >= 8 ? "var(--green)" : r >= 5 ? "var(--accent)" : "var(--red)";

export function RatingPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
        const active = value != null && n <= value;
        return (
          <button key={n} type="button"
            onClick={() => onChange(value === n ? null : n)}
            style={{
              width: 30, height: 30, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: active ? ratingColor(value) : "var(--surface2)",
              color: active ? "#fff" : "var(--text3)",
              border: `1px solid ${active ? ratingColor(value) : "var(--border)"}`,
              transition: "background 0.12s, color 0.12s, border-color 0.12s",
            }}>{n}</button>
        );
      })}
    </div>
  );
}
