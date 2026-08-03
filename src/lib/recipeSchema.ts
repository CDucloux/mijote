/**
 * Schéma de recette : nettoyage à l'export JSON et validation stricte à l'import.
 *
 * @module recipeSchema
 */

/**
 * Retire les champs dépréciés avant d'exporter une recette en JSON, afin que les
 * fichiers générés collent au schéma courant : le `description` de tête et le
 * `title` de chaque étape n'en font plus partie. Les autres champs sont préservés.
 */
export function cleanRecipeForExport(recipe: Record<string, unknown>): Record<string, unknown> {
  const { description: _description, steps, ...rest } = recipe;
  const cleaned: Record<string, unknown> = { ...rest };
  if (Array.isArray(steps)) cleaned.steps = steps.map(({ title: _title, ...step }) => step);
  return cleaned;
}

/**
 * Validation stricte du schéma d'une recette importée. Renvoie la liste des
 * erreurs (vide = conforme). Évite d'injecter des données corrompues dans la base
 * (champs au mauvais type, structures inattendues, valeurs aberrantes).
 *
 * @param r - Donnée importée, de forme inconnue (validée ici avant tout usage).
 * @param label - Étiquette de la recette dans les messages d'erreur.
 */
export function validateRecipeSchema(r: unknown, label: string): string[] {
  const errs: string[] = [];
  if (typeof r !== "object" || r === null || Array.isArray(r)) return [`${label} : ce n'est pas un objet recette.`];
  // Donnée non fiable déjà confirmée « objet » : on accède aux champs via un cast
  // permissif, chaque valeur étant vérifiée avant d'être considérée valide.
  const rec = r as Record<string, unknown>;
  if (typeof rec.name !== "string" || !rec.name.trim()) errs.push(`${label} : champ "name" manquant ou vide.`);
  else if (rec.name.length > 200) errs.push(`${label} : "name" trop long (max 200 caractères).`);
  (["prepTime", "cookTime", "servings"] as const).forEach(k => {
    const v = rec[k];
    if (v != null && (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 100000))
      errs.push(`${label} : "${k}" doit être un nombre positif raisonnable.`);
  });
  if (rec.image != null && typeof rec.image !== "string") errs.push(`${label} : "image" doit être une chaîne.`);
  if (rec.source != null && typeof rec.source !== "string") errs.push(`${label} : "source" doit être une chaîne.`);
  if (rec.tags != null && (!Array.isArray(rec.tags) || rec.tags.some(t => typeof t !== "string")))
    errs.push(`${label} : "tags" doit être un tableau de chaînes.`);
  if (rec.cuisine != null && typeof rec.cuisine !== "string")
    errs.push(`${label} : "cuisine" doit être une chaîne.`);
  if (rec.category != null && typeof rec.category !== "string")
    errs.push(`${label} : "category" doit être une chaîne.`);
  if (rec.collections != null && (!Array.isArray(rec.collections) || rec.collections.some(c => typeof c !== "string")))
    errs.push(`${label} : "collections" doit être un tableau de chaînes.`);
  if (rec.ingredients != null) {
    if (!Array.isArray(rec.ingredients)) errs.push(`${label} : "ingredients" doit être un tableau.`);
    else rec.ingredients.forEach((ing: Record<string, unknown>, j: number) => {
      const who = `ingrédient #${j + 1}`;
      if (typeof ing !== "object" || ing === null || Array.isArray(ing)) { errs.push(`${label} : ${who} invalide.`); return; }
      if (typeof ing.name !== "string" || !ing.name.trim()) errs.push(`${label} : ${who} sans nom.`);
      if (ing.amount != null && (typeof ing.amount !== "number" || Number.isNaN(ing.amount) || ing.amount < 0))
        errs.push(`${label} : ${who} "${ing.name || ""}" → "amount" doit être un nombre positif.`);
      if (ing.unit != null && typeof ing.unit !== "string") errs.push(`${label} : ${who} → "unit" doit être une chaîne.`);
    });
  }
  if (rec.utensils != null) {
    if (!Array.isArray(rec.utensils)) errs.push(`${label} : "utensils" doit être un tableau.`);
    else rec.utensils.forEach((u: Record<string, unknown>, j: number) => {
      if (typeof u !== "object" || u === null || Array.isArray(u) || typeof u.name !== "string" || !u.name.trim())
        errs.push(`${label} : ustensile #${j + 1} invalide (nom requis).`);
    });
  }
  if (rec.steps != null) {
    if (!Array.isArray(rec.steps)) errs.push(`${label} : "steps" doit être un tableau.`);
    else rec.steps.forEach((s: Record<string, unknown>, j: number) => {
      const who = `étape #${j + 1}`;
      if (typeof s !== "object" || s === null || Array.isArray(s)) { errs.push(`${label} : ${who} invalide.`); return; }
      if (s.text != null && typeof s.text !== "string") errs.push(`${label} : ${who} → "text" doit être une chaîne.`);
      if (s.tip != null && typeof s.tip !== "string") errs.push(`${label} : ${who} → "tip" doit être une chaîne.`);
      if (s.image != null && typeof s.image !== "string") errs.push(`${label} : ${who} → "image" doit être une chaîne.`);
      if (s.ingredients != null && !Array.isArray(s.ingredients)) errs.push(`${label} : ${who} → "ingredients" doit être un tableau.`);
      if (s.utensils != null && !Array.isArray(s.utensils)) errs.push(`${label} : ${who} → "utensils" doit être un tableau.`);
    });
  }
  return errs;
}
