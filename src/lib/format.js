// ─── CAPITALISATION ───────────────────────────────────────────────────────────
// Met une majuscule à la première lettre, sans toucher au reste (les noms
// d'ingrédients restent en minuscules « porc fumée » → « Porc fumée »).
export function capitalize(s) {
  if (typeof s !== "string" || !s) return s || "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── QUANTITÉS ────────────────────────────────────────────────────────────────
// Fractions unicode courantes pour un affichage lisible (0.5 → ½, 1.5 → « 1 ½ »).
const FRACTION_GLYPHS = [
  [1 / 2, "½"], [1 / 3, "⅓"], [2 / 3, "⅔"],
  [1 / 4, "¼"], [3 / 4, "¾"],
  [1 / 5, "⅕"], [2 / 5, "⅖"], [3 / 5, "⅗"], [4 / 5, "⅘"],
  [1 / 8, "⅛"], [3 / 8, "⅜"], [5 / 8, "⅝"], [7 / 8, "⅞"],
];

// Formate une quantité numérique : entier tel quel, fraction courante en glyphe
// (½, ⅓, ¾…) éventuellement précédée de la partie entière (« 1 ½ »), sinon décimal
// court à la française (virgule). Gère la mise à l'échelle des portions : appeler
// avec la valeur DÉJÀ multipliée → la fraction évolue d'elle-même (0.5×2 = 1, 0.5×3 = « 1 ½ »).
export function fmtQty(n) {
  if (n === "" || n == null) return "";
  const num = Number(n);
  if (!isFinite(num)) return String(n);
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const whole = Math.floor(abs + 1e-9);
  const frac = abs - whole;
  if (frac < 0.02) return sign + String(whole);
  for (const [v, g] of FRACTION_GLYPHS) {
    if (Math.abs(frac - v) < 0.02) return sign + (whole ? whole + " " : "") + g;
  }
  const rounded = Math.round(abs * 100) / 100;
  return sign + String(rounded).replace(".", ",");
}

// Unites collees a la quantite (les grammes, a la demande) ; les autres sont
// decollees par une espace (« 1 gousse », « 2 c. a s. », « 20 ml »).
const GLUED_UNITS = new Set(["g", "kg", "mg"]);

// Combine quantité + unité pour l'affichage (fraction + espacement corrects).
export function fmtQtyUnit(amount, unit) {
  const q = fmtQty(amount);
  const u = (unit || "").toString().trim();
  if (!u) return q;
  return GLUED_UNITS.has(u.toLowerCase()) ? `${q}${u}` : `${q} ${u}`;
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
