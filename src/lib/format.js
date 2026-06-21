// ─── TIME FORMATTER ───────────────────────────────────────────────────────────
export function fmtTime(min) {
  if (!min && min !== 0) return "—";
  if (min < 60) return min + "m";
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? h + "h" : h + "h" + String(m).padStart(2, "0");
}
