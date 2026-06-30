// ─── JOURNAL D'ITÉRATIONS ─────────────────────────────────────────────────────
// Versionnage léger d'une recette : chaque entrée d'historique combine une note
// de dégustation (rating /10 + notes libres) et un snapshot complet de l'état de
// la recette à cet instant → reproductibilité et rollback. Tout vit dans le doc
// recette (recipe.history[]), donc aucun impact sur la sync Firestore (1 doc/recette).

// Champs « live » capturés dans un snapshot – ceux qui définissent la préparation.
const SNAPSHOT_FIELDS = ["ingredients", "utensils", "steps", "prepTime", "cookTime", "servings", "yield", "nutriLetter", "healthScore"];

// Snapshot de l'état courant d'une recette (copie défensive des tableaux).
export function snapshotOf(recipe) {
  const snap = {};
  for (const f of SNAPSHOT_FIELDS) {
    const v = recipe[f];
    if (v === undefined) continue; // Firestore refuse les valeurs undefined
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

// ─── DIFF ENTRE DEUX SNAPSHOTS ────────────────────────────────────────────────
// Compare un snapshot `base` (ancien) à `target` (le plus récent) et renvoie un
// résumé « git diff » : ingrédients ajoutés/retirés/modifiés, étapes (par index),
// et champs scalaires (temps, portions). Utilisé par la prévisualisation du journal.
const diffKey = n => (n || "").trim().toLowerCase();

export function diffSnapshots(base, target) {
  base = base || {};
  target = target || {};

  // Ingrédients – appariés par nom normalisé.
  const baseIng = new Map((base.ingredients || []).map(i => [diffKey(i.name), i]));
  const targetIng = new Map((target.ingredients || []).map(i => [diffKey(i.name), i]));
  const qtyOf = i => `${i.amount ?? ""}${i.unit ? " " + i.unit : ""}`.trim();
  const ingredients = [];
  for (const [k, ti] of targetIng) {
    const bi = baseIng.get(k);
    if (!bi) ingredients.push({ type: "added", name: ti.name, qty: qtyOf(ti) });
    else if (qtyOf(bi) !== qtyOf(ti)) ingredients.push({ type: "changed", name: ti.name, from: qtyOf(bi), to: qtyOf(ti) });
    else ingredients.push({ type: "same", name: ti.name, qty: qtyOf(ti) });
  }
  for (const [k, bi] of baseIng) {
    if (!targetIng.has(k)) ingredients.push({ type: "removed", name: bi.name, qty: qtyOf(bi) });
  }

  // Ustensiles – appariés par nom normalisé (ajout / retrait, pas de quantité).
  const baseUt = new Map((base.utensils || []).map(u => [diffKey(u.name), u]));
  const targetUt = new Map((target.utensils || []).map(u => [diffKey(u.name), u]));
  const utensils = [];
  for (const [k, tu] of targetUt) {
    if (!baseUt.has(k)) utensils.push({ type: "added", name: tu.name });
    else utensils.push({ type: "same", name: tu.name });
  }
  for (const [k, bu] of baseUt) {
    if (!targetUt.has(k)) utensils.push({ type: "removed", name: bu.name });
  }

  // Étapes – comparées par position.
  const bs = base.steps || [], ts = target.steps || [];
  const steps = [];
  for (let i = 0; i < Math.max(bs.length, ts.length); i++) {
    const b = bs[i], t = ts[i];
    if (b && t) {
      if ((b.description || "") !== (t.description || "")) steps.push({ type: "changed", index: i, from: b.description, to: t.description });
      else steps.push({ type: "same", index: i, description: t.description });
    } else if (t) steps.push({ type: "added", index: i, description: t.description });
    else steps.push({ type: "removed", index: i, description: b.description });
  }

  // Scalaires – temps & portions.
  const scalars = [];
  for (const [field, label, unit] of [["prepTime", "Préparation", " min"], ["cookTime", "Cuisson", " min"], ["servings", "Portions", ""]]) {
    const bv = base[field] ?? null, tv = target[field] ?? null;
    if (bv !== tv) scalars.push({ label, from: bv != null ? bv + unit : "–", to: tv != null ? tv + unit : "–" });
  }

  const hasChanges = scalars.length > 0
    || ingredients.some(i => i.type !== "same")
    || utensils.some(u => u.type !== "same")
    || steps.some(s => s.type !== "same");

  return { ingredients, utensils, steps, scalars, hasChanges };
}
