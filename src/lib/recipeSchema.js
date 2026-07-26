// ─── RECIPE SCHEMA (export cleaning + import validation) ──────────────────────

// Strip deprecated fields before exporting a recipe to JSON, so generated files
// match the current schema: the top-level `description` and each step's `title`
// are no longer part of it. Other fields are preserved untouched.
export function cleanRecipeForExport(recipe) {
  const { description: _description, steps, ...rest } = recipe;
  const cleaned = { ...rest };
  if (Array.isArray(steps)) cleaned.steps = steps.map(({ title: _title, ...step }) => step);
  return cleaned;
}

// Validation stricte du schéma d'une recette importée. Retourne la liste des
// erreurs (vide = conforme). Évite d'injecter des données corrompues dans la base
// (champs au mauvais type, structures inattendues, valeurs aberrantes).
export function validateRecipeSchema(r, label) {
  const errs = [];
  if (typeof r !== "object" || r === null || Array.isArray(r)) return [`${label} : ce n'est pas un objet recette.`];
  if (typeof r.name !== "string" || !r.name.trim()) errs.push(`${label} : champ "name" manquant ou vide.`);
  else if (r.name.length > 200) errs.push(`${label} : "name" trop long (max 200 caractères).`);
  ["prepTime", "cookTime", "servings"].forEach(k => {
    if (r[k] != null && (typeof r[k] !== "number" || Number.isNaN(r[k]) || r[k] < 0 || r[k] > 100000))
      errs.push(`${label} : "${k}" doit être un nombre positif raisonnable.`);
  });
  if (r.image != null && typeof r.image !== "string") errs.push(`${label} : "image" doit être une chaîne.`);
  if (r.source != null && typeof r.source !== "string") errs.push(`${label} : "source" doit être une chaîne.`);
  if (r.tags != null && (!Array.isArray(r.tags) || r.tags.some(t => typeof t !== "string")))
    errs.push(`${label} : "tags" doit être un tableau de chaînes.`);
  if (r.cuisine != null && typeof r.cuisine !== "string")
    errs.push(`${label} : "cuisine" doit être une chaîne.`);
  if (r.category != null && typeof r.category !== "string")
    errs.push(`${label} : "category" doit être une chaîne.`);
  if (r.collections != null && (!Array.isArray(r.collections) || r.collections.some(c => typeof c !== "string")))
    errs.push(`${label} : "collections" doit être un tableau de chaînes.`);
  if (r.ingredients != null) {
    if (!Array.isArray(r.ingredients)) errs.push(`${label} : "ingredients" doit être un tableau.`);
    else r.ingredients.forEach((ing, j) => {
      const who = `ingrédient #${j + 1}`;
      if (typeof ing !== "object" || ing === null || Array.isArray(ing)) { errs.push(`${label} : ${who} invalide.`); return; }
      if (typeof ing.name !== "string" || !ing.name.trim()) errs.push(`${label} : ${who} sans nom.`);
      // `amount` toléré en nombre OU en chaîne numérique ("200", "1,5") : le LLM et
      // certains fichiers renvoient des chaînes. Le stockage/calcul reste via Number().
      if (ing.amount != null && ing.amount !== "") {
        const n = typeof ing.amount === "number" ? ing.amount
          : (typeof ing.amount === "string" && ing.amount.trim() !== "" ? Number(ing.amount.replace(",", ".")) : NaN);
        if (Number.isNaN(n) || n < 0) errs.push(`${label} : ${who} "${ing.name || ""}" → "amount" doit être un nombre positif.`);
      }
      if (ing.unit != null && typeof ing.unit !== "string") errs.push(`${label} : ${who} → "unit" doit être une chaîne.`);
    });
  }
  if (r.utensils != null) {
    if (!Array.isArray(r.utensils)) errs.push(`${label} : "utensils" doit être un tableau.`);
    else r.utensils.forEach((u, j) => {
      if (typeof u !== "object" || u === null || Array.isArray(u) || typeof u.name !== "string" || !u.name.trim())
        errs.push(`${label} : ustensile #${j + 1} invalide (nom requis).`);
    });
  }
  if (r.steps != null) {
    if (!Array.isArray(r.steps)) errs.push(`${label} : "steps" doit être un tableau.`);
    else r.steps.forEach((s, j) => {
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
