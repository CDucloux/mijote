// ─── SAISONNALITÉ (logique pure, sans React) ─────────────────────────────────
// La donnée vit au niveau de l'ingrédient : chaque fruit/légume porte `months`,
// un tableau d'entiers 1-12. La saison d'une recette est CALCULÉE depuis ses
// ingrédients. Un ingrédient disponible toute l'année (12 mois) n'apporte aucun
// signal saisonnier : il est ignoré dans le score.

// Catégories pour lesquelles la saisonnalité a un sens (produits frais).
export const SEASONAL_CATEGORIES = new Set(["vegetable", "fruit", "herbs", "mushroom"]);

// Seuil du score (%) au-delà duquel une recette est considérée « de saison ».
export const SEASON_THRESHOLD = 50;

export const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
export const MONTHS_SHORT_FR = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// Mois courant (1-12), horloge locale.
export function currentMonth() { return new Date().getMonth() + 1; }

// Normalise le champ `months` d'un ingrédient → tableau trié d'entiers 1-12,
// ou `null` si absent / vide / disponible toute l'année (aucun signal saison).
export function ingredientMonths(ing) {
  const m = ing?.months;
  if (!Array.isArray(m)) return null;
  const clean = [...new Set(m.filter(x => Number.isInteger(x) && x >= 1 && x <= 12))].sort((a, b) => a - b);
  if (!clean.length || clean.length >= 12) return null; // 12 mois = toute l'année → ignoré
  return clean;
}

// L'ingrédient est-il de saison ce mois ? `null` = pas de donnée (ignoré).
export function isIngredientInSeason(ing, month = currentMonth()) {
  const m = ingredientMonths(ing);
  if (!m) return null;
  return m.includes(month);
}

// Score de saisonnalité d'une recette (0-100), basé sur ses produits saisonniers.
// `resolver` : (name) => item de la base | null. Retourne `null` si la recette ne
// contient aucun produit saisonnier identifiable (badge « N/A », jamais filtrée).
export function recipeSeasonScore(recipe, resolver, month = currentMonth()) {
  const ings = recipe?.ingredients || [];
  let total = 0, inSeason = 0;
  const seen = new Set();
  for (const ing of ings) {
    const item = resolver ? resolver(ing.name) : null;
    if (!item || seen.has(item.id)) continue;
    const months = ingredientMonths(item);
    if (!months) continue;
    seen.add(item.id);
    total++;
    if (months.includes(month)) inSeason++;
  }
  if (total === 0) return null;
  return { score: Math.round((inSeason / total) * 100), total, inSeason };
}

// Une recette est-elle « de saison » ce mois ? (toggle on/off du filtre).
export function isRecipeInSeason(recipe, resolver, month = currentMonth()) {
  const s = recipeSeasonScore(recipe, resolver, month);
  return s != null && s.score >= SEASON_THRESHOLD;
}

// ─── SÉRIALISATION DES MOIS (pour le Markdown) ───────────────────────────────
// "4-6", "1,7-12", "1-3,11-12" → [1,2,3,…]. Robuste aux espaces et au désordre.
export function parseMonths(str) {
  if (!str || typeof str !== "string") return [];
  const out = new Set();
  for (const tok of str.split(",")) {
    const t = tok.trim();
    if (!t) continue;
    const range = t.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
    if (range) {
      const a = +range[1], b = +range[2];
      for (let n = a; n <= b; n++) if (n >= 1 && n <= 12) out.add(n);
    } else {
      const n = +t;
      if (Number.isInteger(n) && n >= 1 && n <= 12) out.add(n);
    }
  }
  return [...out].sort((a, b) => a - b);
}

// [1,2,3,11,12] → "1-3,11-12". Compresse les suites consécutives en plages.
export function formatMonths(arr) {
  if (!Array.isArray(arr)) return "";
  const m = [...new Set(arr.filter(x => Number.isInteger(x) && x >= 1 && x <= 12))].sort((a, b) => a - b);
  if (!m.length) return "";
  const parts = [];
  let start = m[0], prev = m[0];
  const flush = () => parts.push(start === prev ? `${start}` : `${start}-${prev}`);
  for (let i = 1; i < m.length; i++) {
    if (m[i] === prev + 1) { prev = m[i]; continue; }
    flush(); start = prev = m[i];
  }
  flush();
  return parts.join(",");
}
