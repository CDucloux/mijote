// ─── MIGRATION / FUSION DES DONNÉES DE FOYER (pur) ───────────────────────────
// À l'adhésion, on FUSIONNE de façon additive les données du nouveau membre dans
// celles du foyer, sans rien détruire :
//   • recettes & carnets : union, dédup par nom normalisé (la version du foyer
//     gagne en cas d'homonyme ; les références de carnets locales sont remappées) ;
//   • stock : union des ids ;
//   • planning & listes de courses : on ADOPTE ceux du foyer (un calendrier/des
//     listes partagés ne se fusionnent pas ligne à ligne ; la copie perso reste
//     en sauvegarde dans l'espace solo).

import { normalizeStr } from "./parseIngredient.js";

const byNameSet = (arr, key = "name") => new Set((arr || []).map(x => normalizeStr(x?.[key] || "")));

// Fusionne les données locales (`local`) DANS celles du foyer (`remote`).
export function mergeShared(local, remote) {
  local = local || {};
  remote = remote || {};

  // ── Carnets : dédup par nom, remap des références locales en conflit ──
  const remoteCols = remote.collections || [];
  const remoteColByName = new Map(remoteCols.map(c => [normalizeStr(c.name || ""), c.id]));
  const idRemap = new Map();
  const keptLocalCols = [];
  for (const c of (local.collections || [])) {
    const remoteId = remoteColByName.get(normalizeStr(c.name || ""));
    if (remoteId) idRemap.set(c.id, remoteId);        // homonyme : on pointe vers celui du foyer
    else keptLocalCols.push(c);
  }
  const collections = [...remoteCols, ...keptLocalCols];

  // ── Recettes : union, dédup par nom ; remap des carnets ; id local régénéré si collision ──
  const remoteNames = byNameSet(remote.recipes);
  const remoteIds = new Set((remote.recipes || []).map(r => r.id));
  const remapCols = (r) => {
    const cols = (r.collections || []).map(id => idRemap.get(id) || id);
    return cols.length ? { ...r, collections: [...new Set(cols)] } : r;
  };
  const addedLocal = [];
  for (const r of (local.recipes || [])) {
    if (remoteNames.has(normalizeStr(r.name || ""))) continue;     // homonyme : on garde celle du foyer
    let rr = remapCols(r);
    if (remoteIds.has(rr.id)) rr = { ...rr, id: "r" + Date.now() + Math.random().toString(36).slice(2, 6) };
    addedLocal.push(rr);
  }
  const recipes = [...(remote.recipes || []), ...addedLocal];

  // ── Stock : union des ids ──
  const stock = [...new Set([...(remote.stock || []), ...(local.stock || [])])];
  const lowStock = [...new Set([...(remote.lowStock || []), ...(local.lowStock || [])])];

  // ── Planning & listes : on adopte le foyer ──
  const mealPlan = remote.mealPlan || {};
  const shoppingLists = remote.shoppingLists || [];

  return { recipes, collections, mealPlan, shoppingLists, stock, lowStock };
}
