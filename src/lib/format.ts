/**
 * Formatage d'affichage : capitalisation, quantités (fractions unicode), unités,
 * durées et dates relatives. Tout est côté présentation (français).
 *
 * @module format
 */

/** Valeur numérique acceptée par les formateurs de quantité (tolère string/null). */
type NumLike = number | string | null | undefined;

/**
 * Met une majuscule à la première lettre sans toucher au reste (« porc fumée » →
 * « Porc fumée »).
 *
 * @param s - La chaîne à capitaliser.
 * @returns La chaîne capitalisée, ou `""` pour une entrée vide/non-string.
 */
export function capitalize(s: string | null | undefined): string {
  if (typeof s !== "string" || !s) return s || "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fractions unicode courantes, de la plus utile à la plus rare. */
const FRACTION_GLYPHS: [number, string][] = [
  [1 / 2, "½"], [1 / 3, "⅓"], [2 / 3, "⅔"],
  [1 / 4, "¼"], [3 / 4, "¾"],
  [1 / 5, "⅕"], [2 / 5, "⅖"], [3 / 5, "⅗"], [4 / 5, "⅘"],
  [1 / 8, "⅛"], [3 / 8, "⅜"], [5 / 8, "⅝"], [7 / 8, "⅞"],
];

/**
 * Formate une quantité : entier tel quel, fraction courante en glyphe (½, ⅓, ¾…)
 * précédée au besoin de la partie entière (« 1 ½ »), sinon décimal court à la
 * française (virgule).
 *
 * Pour la mise à l'échelle des portions, passer la valeur DÉJÀ multipliée : la
 * fraction évolue d'elle-même (0.5×2 = « 1 », 0.5×3 = « 1 ½ »).
 *
 * @param n - La quantité (tolère string/null).
 * @returns La quantité formatée pour l'affichage (`""` si vide/nulle).
 */
export function fmtQty(n: NumLike): string {
  if (n === "" || n == null) return "";
  const num = Number(n);
  if (!isFinite(num)) return String(n);
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const whole = Math.floor(abs + 1e-9); // epsilon : évite 1.9999… → 1 sur les fractions
  const frac = abs - whole;
  if (frac < 0.02) return sign + String(whole);
  // Tolérance 0.02 : les fractions issues d'un ×portions ne tombent pas pile.
  for (const [v, g] of FRACTION_GLYPHS) {
    if (Math.abs(frac - v) < 0.02) return sign + (whole ? whole + " " : "") + g;
  }
  const rounded = Math.round(abs * 100) / 100;
  return sign + String(rounded).replace(".", ",");
}

/** Unités collées à la quantité (grammes) ; les autres prennent une espace. */
const GLUED_UNITS = new Set(["g", "kg", "mg"]);

/**
 * Pluriel des unités « comptables » (le stockage reste au singulier canonique ;
 * c'est l'AFFICHAGE qui accorde). Les abréviations (g, ml, c. à s.…) sont invariables.
 */
const PLURAL_UNITS: Record<string, string> = {
  "cuillère à soupe": "cuillères à soupe", "cuillère à café": "cuillères à café",
  "pincée": "pincées", "gousse": "gousses", "sachet": "sachets", "tranche": "tranches",
  "botte": "bottes", "feuille": "feuilles", "branche": "branches", "poignée": "poignées",
  "verre": "verres", "bol": "bols", "tasse": "tasses", "boîte": "boîtes", "pot": "pots", "pièce": "pièces",
};

/**
 * Accorde une unité au pluriel selon la quantité (règle française : pluriel dès
 * |amount| ≥ 2). Le stockage reste au singulier canonique ; c'est l'affichage qui
 * accorde. À utiliser quand l'unité est rendue SÉPARÉMENT de la quantité (fiche
 * recette). Abréviations invariables.
 *
 * @param amount - La quantité (décide de l'accord : pluriel dès |amount| ≥ 2).
 * @param unit - L'unité au singulier canonique.
 * @returns L'unité accordée (`""` si absente).
 */
export function pluralizeUnit(amount: NumLike, unit: string | null | undefined): string {
  const u = (unit || "").toString().trim();
  if (!u) return "";
  const n = Number(amount);
  return (Number.isFinite(n) && Math.abs(n) >= 2) ? (PLURAL_UNITS[u.toLowerCase()] || u) : u;
}

/**
 * Combine quantité et unité pour l'affichage (« 500g », « 1 gousse », « 2 gousses »).
 * L'unité est accordée au pluriel dès que |amount| ≥ 2 ; les grammes sont collés.
 *
 * @param amount - La quantité.
 * @param unit - L'unité au singulier canonique.
 * @returns La chaîne quantité + unité prête à afficher.
 */
export function fmtQtyUnit(amount: NumLike, unit: string | null | undefined): string {
  const q = fmtQty(amount);
  const u = pluralizeUnit(amount, unit);
  if (!u) return q;
  return GLUED_UNITS.has(u.toLowerCase()) ? `${q}${u}` : `${q} ${u}`;
}

/** Noms en -ou prenant un « x » au pluriel (les 7 exceptions classiques + « chou »). */
const OU_PLURAL_X = new Set(["bijou", "caillou", "chou", "genou", "hibou", "joujou", "pou"]);

/**
 * Pluriel français d'un mot simple (règles régulières : -s/-x/-z invariables,
 * -au/-eau/-eu → +x, -al → -aux, -ou → +s sauf exceptions). Couvre les noms
 * d'ingrédients courants (oignon, œuf, poireau, chou…) ; la casse est préservée.
 */
function pluralWord(w: string): string {
  const lo = w.toLowerCase();
  if (/[sxz]$/.test(lo)) return w;
  if (/(au|eau|eu)$/.test(lo)) return w + "x";
  if (/al$/.test(lo)) return w.slice(0, -2) + "aux";
  if (/ou$/.test(lo)) return OU_PLURAL_X.has(lo) ? w + "x" : w + "s";
  return w + "s";
}

/**
 * Accorde un NOM d'ingrédient au pluriel selon la quantité (règle française :
 * pluriel dès |amount| ≥ 2). Seul le mot de tête porte l'accord (« pomme de terre »
 * → « pommes de terre », « blanc de poulet » → « blancs de poulet »). Le stockage
 * reste au singulier canonique ; c'est l'AFFICHAGE qui accorde. À n'appliquer qu'aux
 * ingrédients COMPTABLES (sans unité) : « 800 g tomate » reste au singulier.
 *
 * @param amount - La quantité (accord dès |amount| ≥ 2).
 * @param name - Le nom d'ingrédient au singulier.
 * @returns Le nom accordé (seul le mot de tête change).
 */
export function pluralizeName(amount: NumLike, name: string | null | undefined): string {
  const s = (name || "").toString();
  if (!s) return "";
  const n = Number(amount);
  if (!Number.isFinite(n) || Math.abs(n) < 2) return s;
  return s.replace(/^\S+/, pluralWord);
}

/**
 * Formate une durée en minutes → « 45m », « 1h », « 1h30 ».
 *
 * @param min - La durée en minutes.
 * @returns La durée formatée, ou `–` si absente.
 */
export function fmtTime(min: number | null | undefined): string {
  if (!min && min !== 0) return "–";
  if (min < 60) return min + "m";
  const h = Math.floor(min / 60), m = min % 60;
  return m === 0 ? h + "h" : h + "h" + String(m).padStart(2, "0");
}

/**
 * Date relative en français (« aujourd'hui », « il y a 2 jours », « il y a 1 an »).
 * Échelle jours → semaines → mois → années. Renvoie `""` si l'horodatage est
 * absent ou invalide.
 *
 * @param ts - Horodatage en millisecondes.
 * @param now - Instant de référence (défaut : `Date.now()`).
 */
export function relativeDate(ts: number | null | undefined, now: number = Date.now()): string {
  if (!ts || typeof ts !== "number" || Number.isNaN(ts)) return "";
  const days = Math.floor((now - ts) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days < 7) return `il y a ${days} jour${days > 1 ? "s" : ""}`;
  if (days < 30) { const w = Math.floor(days / 7); return `il y a ${w} semaine${w > 1 ? "s" : ""}`; }
  if (days < 365) { const m = Math.floor(days / 30); return `il y a ${m} mois`; }
  const y = Math.floor(days / 365); return `il y a ${y} an${y > 1 ? "s" : ""}`;
}

/**
 * Retire les tirets cadratins « — » (typiques des textes générés par IA) d'un
 * texte d'affichage : la parenthèse en incise devient une virgule, plus naturelle
 * en français. Les traits d'union « - » et les demi-cadratins « – » (plages de
 * valeurs, ex. « 10–12 min ») sont préservés.
 *
 * @param s - Le texte à nettoyer.
 * @returns Le texte sans tiret cadratin.
 */
export function stripAiDashes(s: string | null | undefined): string {
  if (typeof s !== "string") return s ?? "";
  return s.replace(/\s*—\s*/g, ", ").replace(/\s+,/g, ",").replace(/ {2,}/g, " ").trim();
}
