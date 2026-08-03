/**
 * Normalisation de texte et analyse d'une saisie d'ingrédient (« 500 g farine »
 * → quantité / unité / nom).
 *
 * @module parseIngredient
 */

/**
 * Minuscule + suppression des accents (NFD) + trim : base de comparaison
 * insensible à la casse et aux accents.
 *
 * @param s - La chaîne à normaliser.
 * @returns La chaîne minusculée, sans accents ni espaces de bord.
 */
export function normalizeStr(s: string | null | undefined): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Résultat d'une saisie analysée. `amount` vaut `""` si aucune quantité. */
export interface ParsedIngredient {
  amount: number | string;
  unit: string;
  name: string;
}

/**
 * Analyse une saisie libre en `{ amount, unit, name }` (« 2 gousses d'ail » →
 * `{ amount: 2, unit: "gousses", name: "ail" }`). Gère les entiers, décimaux et
 * fractions (`1/2`, « 1 1/2 »). Sans quantité reconnue, tout part dans `name`.
 *
 * @param raw - La saisie libre de l'utilisateur.
 * @returns `{ amount, unit, name }` (`amount` = `""` si aucune quantité reconnue).
 */
export function parseIngredientInput(raw: string | null | undefined): ParsedIngredient {
  if (!raw || !raw.trim()) return { amount: "", unit: "", name: (raw || "").trim() };
  const s = raw.trim();

  // Testées de la plus longue à la plus courte : tie-break défensif, même si la
  // frontière de mot (plus bas) suffit déjà à éviter que « g » avale « gousse ».
  const UNITS = [
    "cuillère à soupe", "cuillères à soupe", "c. à soupe", "c.à.s",
    "cuillère à café", "cuillères à café", "c. à café", "c.à.c",
    "kg", "g", "mg", "l", "litre", "litres", "cl", "ml", "dl",
    "pièce", "pièces", "pce", "pc",
    "tranche", "tranches", "botte", "bottes", "sachet", "sachets",
    "gousse", "gousses", "feuille", "feuilles", "branche", "branches",
    "pincée", "pincées", "poignée", "poignées", "verre", "verres",
    "bol", "bols", "tasse", "tasses", "boîte", "boîtes", "pot", "pots",
  ].sort((a, b) => b.length - a.length);

  const fracMap: Record<string, number> = { "1/2": 0.5, "1/3": 0.333, "2/3": 0.667, "1/4": 0.25, "3/4": 0.75 };
  const numRe = /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*/;
  const fracRe = /^(1\/2|1\/3|2\/3|1\/4|3\/4)\s*/;

  let rest = s;
  let amount = "";

  const mFrac = rest.match(fracRe);
  const mNum = rest.match(numRe);
  if (mFrac) {
    amount = String(fracMap[mFrac[1]] || mFrac[1]);
    rest = rest.slice(mFrac[0].length);
  } else if (mNum) {
    amount = mNum[1].replace(",", ".");
    rest = rest.slice(mNum[0].length);
    const mFrac2 = rest.match(fracRe); // gère « 1 1/2 »
    if (mFrac2) {
      amount = String(parseFloat(amount) + (fracMap[mFrac2[1]] || 0));
      rest = rest.slice(mFrac2[0].length);
    }
  }

  if (!amount) return { amount: "", unit: "", name: s };

  // L'unité doit être suivie d'une frontière de mot (espace ou fin) : « g » ne
  // capture plus « gousse », ni « l » « litre ».
  let unit = "";
  const restLower = rest.toLowerCase();
  for (const u of UNITS) {
    const ul = u.toLowerCase();
    if (restLower.startsWith(ul)) {
      const next = rest.charAt(ul.length); // "" en fin de chaîne
      if (next === "" || /\s/.test(next)) {
        unit = u;
        rest = rest.slice(u.length).trim();
        rest = rest.replace(/^d[e']?\s*/i, "").trim(); // retire un « de » / « d' » de liaison
        break;
      }
    }
  }

  return { amount: parseFloat(amount) || amount, unit, name: rest.trim() };
}
