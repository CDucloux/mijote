// ─── CAPITALISATION ───────────────────────────────────────────────────────────
// Met une majuscule à la première lettre, sans toucher au reste (les noms
// d'ingrédients restent en minuscules « porc fumée » → « Porc fumée »).
export function capitalize(s) {
  if (typeof s !== "string" || !s) return s || "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── TIME FORMATTER ───────────────────────────────────────────────────────────
export function fmtTime(min) {
  if (!min && min !== 0) return "–";
  if (min < 60) return min + "m";
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? h + "h" : h + "h" + String(m).padStart(2, "0");
}

// ─── DATE RELATIVE (« aujourd'hui », « il y a 2 jours », « il y a 1 an »…) ─────
// Renvoie "" si l'horodatage est absent/invalide. Échelle : jours → semaines →
// mois → années, avec accord du pluriel (« mois » invariable).
export function relativeDate(ts, now = Date.now()) {
  if (!ts || typeof ts !== "number" || Number.isNaN(ts)) return "";
  const days = Math.floor((now - ts) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days < 7) return `il y a ${days} jour${days > 1 ? "s" : ""}`;
  if (days < 30) { const w = Math.floor(days / 7); return `il y a ${w} semaine${w > 1 ? "s" : ""}`; }
  if (days < 365) { const m = Math.floor(days / 30); return `il y a ${m} mois`; }
  const y = Math.floor(days / 365); return `il y a ${y} an${y > 1 ? "s" : ""}`;
}
