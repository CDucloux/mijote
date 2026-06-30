const NUTRI_COLORS = { A: "#1a8a3c", B: "#85bb2f", C: "#f9c813", D: "#e07515", E: "#e63312" };

// Badge Nutri-Score façon étiquette officielle : barre blanche, 5 lettres,
// la lettre active surélevée et pleine, les autres réduites et atténuées.
export const NutriScoreBadge = ({ letter, compact }) => {
  if (!letter) return <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text3)" }}>–</span>;
  if (compact) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 22, height: 22, borderRadius: 6,
        background: NUTRI_COLORS[letter],
        fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1,
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
      }}>{letter}</span>
    );
  }
  const letters = ["A", "B", "C", "D", "E"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 4px", boxShadow: "0 1px 3px rgba(0,0,0,0.14)" }}>
      {letters.map(l => {
        const active = l === letter;
        return (
          <span key={l} style={{
            width: active ? 21 : 15, height: active ? 25 : 18,
            borderRadius: active ? 5 : 3,
            background: NUTRI_COLORS[l],
            opacity: active ? 1 : 0.5,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: active ? 14 : 10, fontWeight: 800, color: "#fff", lineHeight: 1,
            transition: "all 0.2s",
          }}>{l}</span>
        );
      })}
    </div>
  );
};
