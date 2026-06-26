// ─── CAPITALISATION ───────────────────────────────────────────────────────────
// Met une majuscule à la première lettre, sans toucher au reste (les noms
// d'ingrédients restent en minuscules « porc fumée » → « Porc fumée »).
export function capitalize(s) {
  if (typeof s !== "string" || !s) return s || "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── TIME FORMATTER ───────────────────────────────────────────────────────────
export function fmtTime(min) {
  if (!min && min !== 0) return "—";
  if (min < 60) return min + "m";
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? h + "h" : h + "h" + String(m).padStart(2, "0");
}
