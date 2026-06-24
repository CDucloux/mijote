// ─── JOURNAL D'ITÉRATIONS ─────────────────────────────────────────────────────
// Versionnage léger d'une recette : chaque entrée d'historique combine une note
// de dégustation (rating /10 + notes libres) et un snapshot complet de l'état de
// la recette à cet instant → reproductibilité et rollback. Tout vit dans le doc
// recette (recipe.history[]), donc aucun impact sur la sync Firestore (1 doc/recette).

// Champs « live » capturés dans un snapshot — ceux qui définissent la préparation.
const SNAPSHOT_FIELDS = ["ingredients", "steps", "prepTime", "cookTime", "servings", "yield", "nutriLetter", "healthScore"];

// Snapshot de l'état courant d'une recette (copie défensive des tableaux).
export function snapshotOf(recipe) {
  const snap = {};
  for (const f of SNAPSHOT_FIELDS) {
    const v = recipe[f];
    snap[f] = Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : v;
  }
  return snap;
}

// Prochain label par défaut : v1, v2, … basé sur le nombre d'entrées.
export function nextVersionLabel(history) {
  return "v" + ((history?.length || 0) + 1);
}

// Ajoute une entrée d'historique (snapshot de l'état courant + métadonnées).
// rating : nombre /10 ou null ; notes/label : chaînes.
export function addVersion(recipe, { label, rating, notes }) {
  const entry = {
    id: "h" + Date.now(),
    label: (label || "").trim() || nextVersionLabel(recipe.history),
    createdAt: new Date().toISOString(),
    rating: Number.isFinite(rating) ? rating : null,
    notes: (notes || "").trim(),
    snapshot: snapshotOf(recipe),
  };
  return { ...recipe, history: [...(recipe.history || []), entry] };
}

// Restaure une version : réécrit les champs live avec le snapshot, après avoir
// figé l'état courant en entrée auto (pour ne rien perdre).
export function restoreVersion(recipe, entryId) {
  const history = recipe.history || [];
  const target = history.find(h => h.id === entryId);
  if (!target) return recipe;
  const autoEntry = {
    id: "h" + Date.now(),
    label: nextVersionLabel(history),
    createdAt: new Date().toISOString(),
    rating: null,
    notes: `Sauvegarde auto avant restauration de « ${target.label} »`,
    snapshot: snapshotOf(recipe),
  };
  return { ...recipe, ...target.snapshot, history: [...history, autoEntry] };
}

// Supprime une entrée d'historique.
export function deleteVersion(recipe, entryId) {
  return { ...recipe, history: (recipe.history || []).filter(h => h.id !== entryId) };
}
