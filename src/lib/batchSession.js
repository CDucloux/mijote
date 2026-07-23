// ─── SESSION BATCH (vue dérivée du graphe, logique pure) ─────────────────────
// Le batch cooking n'est PAS un module : c'est une VUE dérivée du planning de la
// semaine et du graphe de sous-recettes. On agrège :
//   1. les plats à cuisiner (regroupés ; les portions réutilisées = une seule
//      cuisson pour plusieurs repas — d'où le nombre de « cuissons ») ;
//   2. les préparations de base partagées entre plusieurs recettes de la semaine,
//      avec la quantité totale à préparer d'avance (le vrai différenciateur : rien
//      dans une app de contenu ne connaît le rendement ni le partage des bases).

const num = (x) => { const n = Number(String(x ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

// `entries` : items du mealPlan de la semaine (aplatis, tous jours/créneaux).
// `recipes` : bibliothèque. Renvoie { dishes, bases }.
export function buildBatchSession(entries = [], recipes = []) {
  const byId = new Map(recipes.map(r => [r.id, r]));

  // 1. Regroupe les items par recette. Le champ `portions` (= repas couverts par
  //    une cuisson) sert à déduire le nombre de cuissons réelles.
  const groups = new Map();
  for (const e of entries) {
    const r = byId.get(e.recipeId);
    if (!r || r.isComponent) continue;
    let g = groups.get(e.recipeId);
    if (!g) { g = { recipe: r, meals: 0, batch: Math.max(1, num(e.portions) || 1) }; groups.set(e.recipeId, g); }
    g.meals++;
    g.batch = Math.max(g.batch, Math.max(1, num(e.portions) || 1));
  }

  const dishes = [...groups.values()].map(g => {
    const cookings = Math.max(1, Math.ceil(g.meals / g.batch));
    return { recipe: g.recipe, meals: g.meals, cookings, servings: cookings * (num(g.recipe.servings) || 2) };
  }).sort((a, b) => b.meals - a.meals || (a.recipe.name || "").localeCompare(b.recipe.name || ""));

  // 2. Préparations de base : pour chaque cuisson d'un plat, on somme les lignes
  //    référençant une base (× nb de cuissons), dans l'unité du rendement de la base.
  const basesMap = new Map();
  for (const d of dishes) {
    for (const line of d.recipe.ingredients || []) {
      if (!line.recipeId) continue;
      const base = byId.get(line.recipeId);
      if (!base || !(base.yield && num(base.yield.amount) > 0)) continue;
      let b = basesMap.get(base.id);
      if (!b) { b = { recipe: base, amount: 0, unit: base.yield.unit || "", usedBy: new Set() }; basesMap.set(base.id, b); }
      b.amount += d.cookings * num(line.amount);
      b.usedBy.add(d.recipe.name);
    }
  }

  const bases = [...basesMap.values()]
    .map(b => ({ recipe: b.recipe, amount: +b.amount.toFixed(2), unit: b.unit, usedBy: [...b.usedBy], shared: b.usedBy.size > 1 }))
    .sort((a, b) => Number(b.shared) - Number(a.shared) || b.usedBy.length - a.usedBy.length || (a.recipe.name || "").localeCompare(b.recipe.name || ""));

  return { dishes, bases };
}

// Aplatit le mealPlan (objet {date: [items]}) sur une liste de dates en une liste d'items.
export function weekEntries(mealPlan = {}, dates = []) {
  const out = [];
  for (const d of dates) for (const it of mealPlan[d] || []) out.push(it);
  return out;
}
