// Sélecteur de note réutilisable (carnet d'itérations, fin de cook mode).

export const ratingColor = (rating: number): string =>
  rating >= 8 ? "var(--green)" : rating >= 5 ? "var(--accent)" : "var(--red)";

interface RatingPickerProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
}

export function RatingPicker({ value, onChange }: RatingPickerProps) {
  return (
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
        const active = value != null && n <= value;
        const accent = value != null && n <= value ? ratingColor(value) : null;
        return (
          <button key={n} type="button"
            onClick={() => onChange(value === n ? null : n)}
            style={{
              width: 30, height: 30, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: accent ?? "var(--surface2)",
              color: active ? "#fff" : "var(--text3)",
              border: `1px solid ${accent ?? "var(--border)"}`,
              transition: "background 0.12s, color 0.12s, border-color 0.12s",
            }}>{n}</button>
        );
      })}
    </div>
  );
}
