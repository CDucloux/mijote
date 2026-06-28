// ─── SCORE SANTÉ — Nutri-Score (algorithme 2023, aliments généraux) ─────────
// On agrège les nutriments de TOUTE la recette ramenés à 100g de plat fini,
// puis on calcule un unique Nutri-Score, mappé sur l'échelle 0-100 du ring.
// Tables de seuils par 100g : `nsPoints` renvoie l'index du 1er seuil non dépassé.
const NS_ENERGY = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350];                 // kJ → 0..10
const NS_SUGAR  = [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51];             // g  → 0..15
const NS_SATFAT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];                                            // g  → 0..10
const NS_SALT   = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.4, 2.6, 2.8, 3, 3.4, 3.8, 4.2, 4.6, 5]; // g → 0..20
const NS_FIBER  = [3.0, 4.1, 5.2, 6.3, 7.4];                                                  // g  → 0..5
const NS_PROT   = [2.4, 4.8, 7.2, 9.6, 12, 14, 17];                                           // g  → 0..7

function nsPoints(value, thresholds) {
  for (let i = 0; i < thresholds.length; i++) if (value <= thresholds[i]) return i;
  return thresholds.length;
}

// Mappe le Nutri-Score brut (négatif = sain) sur 0-100, par paliers alignés
// sur les lettres A–E et les couleurs du ring (A/B ≥70 vert, C 50-70 jaune, D/E <50 rouge).
function nutriToScore100(ns) {
  const pts = [[-7, 100], [0, 80], [2, 70], [10, 50], [18, 30], [28, 0]];
  if (ns <= pts[0][0]) return 100;
  if (ns >= pts[pts.length - 1][0]) return 0;
  for (let i = 1; i < pts.length; i++) {
    if (ns <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return Math.round(y0 + (y1 - y0) * (ns - x0) / (x1 - x0));
    }
  }
  return 0;
}

// Conversion d'une unité vers des grammes (approximations culinaires).
// Valeur objet `{ g, piece: true }` → unité « à la pièce » : on privilégie le
// `gramsPerPiece` de l'ingrédient s'il est renseigné, sinon `g` sert de défaut.
export const UNIT_GRAMS = {
  // Masse
  "mg": 0.001, "g": 1, "kg": 1000,
  // Volume (≈ 1 g/ml)
  "ml": 1, "cl": 10, "dl": 100, "l": 1000, "litre": 1000, "litres": 1000,
  // Mesures de cuisine
  "cuillère à soupe": 15, "cuillères à soupe": 15, "c. à soupe": 15, "c.à.s": 15,
  "cuillère à café": 5, "cuillères à café": 5, "c. à café": 5, "c.à.c": 5,
  "pincée": 0.4, "pincées": 0.4,
  "verre": 200, "verres": 200, "tasse": 200, "tasses": 200, "bol": 350, "bols": 350,
  // Pièces (poids par défaut, surchargé par gramsPerPiece de l'ingrédient)
  "pièce": { g: 100, piece: true }, "pièces": { g: 100, piece: true }, "pce": { g: 100, piece: true }, "pc": { g: 100, piece: true },
  "tranche": { g: 25, piece: true }, "tranches": { g: 25, piece: true },
  "gousse": { g: 5, piece: true }, "gousses": { g: 5, piece: true },
  "botte": { g: 100, piece: true }, "bottes": { g: 100, piece: true },
  "sachet": { g: 10, piece: true }, "sachets": { g: 10, piece: true },
  "feuille": { g: 2, piece: true }, "feuilles": { g: 2, piece: true },
  "branche": { g: 5, piece: true }, "branches": { g: 5, piece: true },
  "poignée": { g: 30, piece: true }, "poignées": { g: 30, piece: true },
  "boîte": { g: 400, piece: true }, "boîtes": { g: 400, piece: true },
  "pot": { g: 125, piece: true }, "pots": { g: 125, piece: true },
};

// Masse en grammes d'une ligne d'ingrédient de recette. Unité inconnue/vide → grammes.
export function ingredientGrams(recipeIng, dbItem) {
  const amount = parseFloat(String(recipeIng.amount).replace(",", ".")) || 1;
  const unit = (recipeIng.unit || "").trim().toLowerCase();
  const entry = UNIT_GRAMS[unit];
  let perUnit;
  if (entry == null) perUnit = 1;                                     // unité inconnue → on suppose des grammes
  else if (typeof entry === "object") perUnit = dbItem?.gramsPerPiece || entry.g; // pièce : poids spécifique sinon défaut
  else perUnit = entry;
  return Math.max(amount * perUnit, 1);
}

// ─── COMPOSANTS (préparations de base) ───────────────────────────────────────
// Une ligne d'ingrédient référence soit un ingrédient brut (dbId), soit un
// composant = une autre recette (recipeId). v1 : composition mono-niveau (un
// composant ne contient que des ingrédients bruts), donc pas de cycle possible.
const num = v => parseFloat(String(v).replace(",", ".")) || 0;
export const isComponentLine = (line) => !!line && !!line.recipeId && !line.dbId;
export const buildRecipeIndex = (recipes) => new Map((recipes || []).map(r => [r.id, r]));

// Agrège les ingrédients BRUTS d'une liste (ignore toute sous-référence composant).
function aggregateRaw(ingredients, ingredientDB, keys, wantVeg) {
  const tot = Object.fromEntries(keys.map(k => [k, 0]));
  let mass = 0, covered = 0, vegMass = 0;
  for (const ci of ingredients || []) {
    if (!ci || ci.recipeId) continue;
    const di = ingredientDB.find(d => d.id === ci.dbId);
    if (!di) continue;
    const cm = ingredientGrams(ci, di);
    mass += cm;
    if (di.nutrition) {
      for (const k of keys) tot[k] += (di.nutrition[k] || 0) * cm / 100;
      covered += cm;
      if (wantVeg && di.nutrition.isVegetable) vegMass += cm;
    }
  }
  return { tot, mass, covered, vegMass };
}

// Contribution nutritionnelle d'une ligne composant à sa recette parente.
// fraction f = consommé / rendement ; masse finie = consommé (g/ml, ≈1g/ml)
// ou f×masseBrute (pièce, faute d'équivalence directe). La réduction est ainsi
// reflétée : nutriments = totauxBruts×f répartis sur la masse FINIE → densité ↑.
function componentContribution(line, recipesById, ingredientDB, keys, wantVeg) {
  const comp = recipesById && recipesById.get(line.recipeId);
  if (!comp || !(comp.yield && comp.yield.amount > 0)) return null; // orphelin → ignoré
  const f = num(line.amount) / comp.yield.amount;
  const agg = aggregateRaw(comp.ingredients, ingredientDB, keys, wantVeg);
  const unit = (comp.yield.unit || "g").toLowerCase();
  const finished = (unit === "g" || unit === "ml") ? num(line.amount) : f * agg.mass;
  const covFrac = agg.mass ? agg.covered / agg.mass : 0;
  const vegFrac = agg.mass ? agg.vegMass / agg.mass : 0;
  const totAdd = Object.fromEntries(keys.map(k => [k, agg.tot[k] * f]));
  return { totAdd, massAdd: finished, coveredAdd: finished * covFrac, vegAdd: finished * vegFrac };
}

const NS_KEYS = ["calories", "sugar", "saturatedFat", "salt", "fiber", "protein"];
export function computeNutriInfo(ingredients, ingredientDB, recipesById) {
  if (!ingredients || ingredients.length === 0) return { score: 50, letter: null };
  let mass = 0, vegMass = 0;
  const tot = { calories: 0, sugar: 0, saturatedFat: 0, salt: 0, fiber: 0, protein: 0 };
  for (const recipeIng of ingredients) {
    if (isComponentLine(recipeIng)) { // composant → contribution agrégée (sur sa masse couverte)
      const c = componentContribution(recipeIng, recipesById, ingredientDB, NS_KEYS, true);
      if (!c) continue;
      for (const k of NS_KEYS) tot[k] += c.totAdd[k];
      vegMass += c.vegAdd;
      mass += c.coveredAdd;
      continue;
    }
    const dbItem = ingredientDB.find(d => d.id === recipeIng.dbId);
    if (!dbItem || !dbItem.nutrition) continue; // maille ingrédient : pas de nutrition → ignoré
    const m = ingredientGrams(recipeIng, dbItem);
    const n = dbItem.nutrition;
    tot.calories     += (n.calories || 0)     * m / 100;
    tot.sugar        += (n.sugar || 0)        * m / 100;
    tot.saturatedFat += (n.saturatedFat || 0) * m / 100;
    tot.salt         += (n.salt || 0)         * m / 100;
    tot.fiber        += (n.fiber || 0)        * m / 100;
    tot.protein      += (n.protein || 0)      * m / 100;
    if (n.isVegetable) vegMass += m;
    mass += m;
  }
  if (mass === 0) return { score: 50, letter: null }; // aucune maille avec nutrition
  // Profil pour 100g de plat fini
  const per100 = k => tot[k] / mass * 100;
  // Points négatifs (énergie en kJ, sucres, AG saturés, sel)
  const N = nsPoints(per100("calories") * 4.184, NS_ENERGY)
          + nsPoints(per100("sugar"), NS_SUGAR)
          + nsPoints(per100("saturatedFat"), NS_SATFAT)
          + nsPoints(per100("salt"), NS_SALT);
  // Points positifs (part de végétaux, fibres, protéines)
  const vegFrac = vegMass / mass * 100;
  const vegPts = vegFrac > 80 ? 5 : vegFrac > 60 ? 2 : vegFrac > 40 ? 1 : 0;
  const fiberPts = nsPoints(per100("fiber"), NS_FIBER);
  const proteinPts = nsPoints(per100("protein"), NS_PROT);
  // Règle Nutri-Score : si N≥11 et part de végétaux < 5 pts, les protéines ne comptent pas
  const P = vegPts + fiberPts + (N >= 11 && vegPts < 5 ? 0 : proteinPts);
  const ns = N - P;
  const letter = ns <= -1 ? "A" : ns <= 2 ? "B" : ns <= 10 ? "C" : ns <= 18 ? "D" : "E";
  return { score: nutriToScore100(ns), letter };
}

export function computeHealthScore(ingredients, ingredientDB, recipesById) {
  return computeNutriInfo(ingredients, ingredientDB, recipesById).score;
}

// Agrégation nutritionnelle complète d'une recette : totaux, par portion et
// pour 100 g de plat fini. `coverage` = part de la masse (ingrédients reconnus)
// disposant réellement de données nutritionnelles → transparence sur la fiabilité.
const NUTRI_KEYS = ["calories", "protein", "carbs", "sugar", "fat", "saturatedFat", "omega3", "fiber", "salt"];
export function computeNutritionDetail(ingredients, ingredientDB, servings, recipesById) {
  const tot = Object.fromEntries(NUTRI_KEYS.map(k => [k, 0]));
  let mass = 0, covered = 0;
  for (const recipeIng of ingredients || []) {
    if (isComponentLine(recipeIng)) { // composant → ingrédient virtuel (masse finie au dénominateur)
      const c = componentContribution(recipeIng, recipesById, ingredientDB, NUTRI_KEYS, false);
      if (!c) continue;
      for (const k of NUTRI_KEYS) tot[k] += c.totAdd[k];
      mass += c.massAdd;
      covered += c.coveredAdd;
      continue;
    }
    const dbItem = ingredientDB.find(d => d.id === recipeIng.dbId);
    if (!dbItem) continue;
    const m = ingredientGrams(recipeIng, dbItem);
    mass += m;
    if (dbItem.nutrition) {
      const n = dbItem.nutrition;
      for (const k of NUTRI_KEYS) tot[k] += (n[k] || 0) * m / 100;
      covered += m;
    }
  }
  const s = Math.max(1, servings || 1);
  const perServing = Object.fromEntries(NUTRI_KEYS.map(k => [k, tot[k] / s]));
  const per100 = Object.fromEntries(NUTRI_KEYS.map(k => [k, covered ? tot[k] / covered * 100 : 0]));
  return { totals: tot, perServing, per100, mass, covered, coverage: mass ? covered / mass : 0 };
}
