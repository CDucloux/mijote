/**
 * Journal d'itérations : versionnage léger d'une recette. Chaque entrée combine
 * une note de dégustation (rating /10 + notes libres) et un snapshot complet de
 * l'état de la recette → reproductibilité et rollback. Tout vit dans le doc
 * recette (`recipe.history[]`), donc aucun impact sur la sync (1 doc/recette).
 *
 * @module history
 */

interface IngredientLike { name?: string; amount?: number | string | null; unit?: string | null }
interface UtensilLike { name?: string }
interface StepLike { description?: string }

/** Instantané des champs « live » d'une recette (ceux qui définissent la préparation). */
export interface Snapshot {
  ingredients?: IngredientLike[];
  utensils?: UtensilLike[];
  steps?: StepLike[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  yield?: unknown;
  nutriLetter?: string;
  healthScore?: number;
  [k: string]: unknown;
}

/** Une entrée du journal : métadonnées + snapshot figé. */
export interface HistoryEntry {
  id: string;
  label: string;
  createdAt: string;
  rating: number | null;
  notes: string;
  snapshot: Snapshot;
}

/** Recette porteuse d'un historique (forme souple : autres champs tolérés). */
export interface HistoryRecipe {
  history?: HistoryEntry[];
  [k: string]: unknown;
}

const SNAPSHOT_FIELDS = ["ingredients", "utensils", "steps", "prepTime", "cookTime", "servings", "yield", "nutriLetter", "healthScore"] as const;

/** Snapshot de l'état courant (copie défensive des tableaux). */
export function snapshotOf(recipe: HistoryRecipe): Snapshot {
  const snap: Snapshot = {};
  for (const f of SNAPSHOT_FIELDS) {
    const v = recipe[f];
    if (v === undefined) continue; // Firestore refuse les valeurs undefined
    snap[f] = Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : v;
  }
  return snap;
}

/** Prochain label par défaut : v1, v2, … selon le nombre d'entrées. */
export function nextVersionLabel(history: HistoryEntry[] | null | undefined): string {
  return "v" + ((history?.length || 0) + 1);
}

/** Ajoute une entrée (snapshot courant + métadonnées) et renvoie la recette mise à jour. */
export function addVersion(recipe: HistoryRecipe, { label, rating, notes }: { label?: string; rating?: number | null; notes?: string }): HistoryRecipe {
  const entry: HistoryEntry = {
    id: "h" + Date.now(),
    label: (label || "").trim() || nextVersionLabel(recipe.history),
    createdAt: new Date().toISOString(),
    rating: typeof rating === "number" && Number.isFinite(rating) ? rating : null,
    notes: (notes || "").trim(),
    snapshot: snapshotOf(recipe),
  };
  return { ...recipe, history: [...(recipe.history || []), entry] };
}

/** Restaure une version : réécrit les champs live, après avoir figé l'état courant
 * en entrée auto (pour ne rien perdre). */
export function restoreVersion(recipe: HistoryRecipe, entryId: string): HistoryRecipe {
  const history = recipe.history || [];
  const target = history.find(h => h.id === entryId);
  if (!target) return recipe;
  const autoEntry: HistoryEntry = {
    id: "h" + Date.now(),
    label: nextVersionLabel(history),
    createdAt: new Date().toISOString(),
    rating: null,
    notes: `Sauvegarde auto avant restauration de « ${target.label} »`,
    snapshot: snapshotOf(recipe),
  };
  return { ...recipe, ...target.snapshot, history: [...history, autoEntry] };
}

/** Supprime une entrée d'historique. */
export function deleteVersion(recipe: HistoryRecipe, entryId: string): HistoryRecipe {
  return { ...recipe, history: (recipe.history || []).filter(h => h.id !== entryId) };
}

// ─── DIFF ENTRE DEUX SNAPSHOTS ────────────────────────────────────────────────

export type IngredientDiff =
  | { type: "added"; name?: string; qty: string }
  | { type: "removed"; name?: string; qty: string }
  | { type: "changed"; name?: string; from: string; to: string }
  | { type: "same"; name?: string; qty: string };
export type UtensilDiff = { type: "added" | "removed" | "same"; name?: string };
export type StepDiff =
  | { type: "added" | "removed" | "same"; index: number; description?: string }
  | { type: "changed"; index: number; from?: string; to?: string };
export interface ScalarDiff { label: string; from: string; to: string }

/** Résumé « git diff » entre deux snapshots. */
export interface SnapshotDiff {
  ingredients: IngredientDiff[];
  utensils: UtensilDiff[];
  steps: StepDiff[];
  scalars: ScalarDiff[];
  hasChanges: boolean;
}

const diffKey = (n: string | undefined): string => (n || "").trim().toLowerCase();

/**
 * Compare un snapshot `base` (ancien) à `target` (récent). Ingrédients et
 * ustensiles sont appariés par nom normalisé ; les étapes par position.
 */
export function diffSnapshots(base: Snapshot | null | undefined, target: Snapshot | null | undefined): SnapshotDiff {
  const b = base || {}, t = target || {};

  const baseIng = new Map((b.ingredients || []).map(i => [diffKey(i.name), i]));
  const targetIng = new Map((t.ingredients || []).map(i => [diffKey(i.name), i]));
  const qtyOf = (i: IngredientLike): string => `${i.amount ?? ""}${i.unit ? " " + i.unit : ""}`.trim();
  const ingredients: IngredientDiff[] = [];
  for (const [k, ti] of targetIng) {
    const bi = baseIng.get(k);
    if (!bi) ingredients.push({ type: "added", name: ti.name, qty: qtyOf(ti) });
    else if (qtyOf(bi) !== qtyOf(ti)) ingredients.push({ type: "changed", name: ti.name, from: qtyOf(bi), to: qtyOf(ti) });
    else ingredients.push({ type: "same", name: ti.name, qty: qtyOf(ti) });
  }
  for (const [k, bi] of baseIng) {
    if (!targetIng.has(k)) ingredients.push({ type: "removed", name: bi.name, qty: qtyOf(bi) });
  }

  const baseUt = new Map((b.utensils || []).map(u => [diffKey(u.name), u]));
  const targetUt = new Map((t.utensils || []).map(u => [diffKey(u.name), u]));
  const utensils: UtensilDiff[] = [];
  for (const [k, tu] of targetUt) utensils.push({ type: baseUt.has(k) ? "same" : "added", name: tu.name });
  for (const [k, bu] of baseUt) if (!targetUt.has(k)) utensils.push({ type: "removed", name: bu.name });

  const bs = b.steps || [], ts = t.steps || [];
  const steps: StepDiff[] = [];
  for (let i = 0; i < Math.max(bs.length, ts.length); i++) {
    const bStep = bs[i], tStep = ts[i];
    if (bStep && tStep) {
      if ((bStep.description || "") !== (tStep.description || "")) steps.push({ type: "changed", index: i, from: bStep.description, to: tStep.description });
      else steps.push({ type: "same", index: i, description: tStep.description });
    } else if (tStep) steps.push({ type: "added", index: i, description: tStep.description });
    else steps.push({ type: "removed", index: i, description: bStep!.description });
  }

  const scalars: ScalarDiff[] = [];
  for (const [field, label, unit] of [["prepTime", "Préparation", " min"], ["cookTime", "Cuisson", " min"], ["servings", "Portions", ""]] as const) {
    const bv = (b[field] ?? null) as number | null;
    const tv = (t[field] ?? null) as number | null;
    if (bv !== tv) scalars.push({ label, from: bv != null ? bv + unit : "–", to: tv != null ? tv + unit : "–" });
  }

  const hasChanges = scalars.length > 0
    || ingredients.some(i => i.type !== "same")
    || utensils.some(u => u.type !== "same")
    || steps.some(s => s.type !== "same");

  return { ingredients, utensils, steps, scalars, hasChanges };
}
