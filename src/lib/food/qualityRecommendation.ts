/**
 * Recommandation de qualité d'un ingrédient : quelle FORME privilégier à l'achat
 * (frais, surgelé…) pour un meilleur résultat culinaire. Logique pure, sans I/O ni
 * React. Pas de moteur de règles ni de scoring : la recommandation est portée,
 * ingrédient par ingrédient, par le champ optionnel `qualityRecommendation` de la
 * base. Ce module se contente de valider ce champ et d'en dériver un libellé court.
 *
 * @module food/qualityRecommendation
 */
import type { IngredientDbItem, IngredientForm, QualityRecommendation } from "@/lib/types";

/** Formes reconnues (vocabulaire fermé), avec leur adjectif d'affichage (masculin). */
export const INGREDIENT_FORMS: Record<IngredientForm, string> = {
  fresh: "frais",
  frozen: "surgelé",
  canned: "en conserve",
  jarred: "en bocal",
  dried: "séché",
};

/** Ordre d'affichage stable des formes (indépendant de l'ordre saisi). */
const FORM_ORDER: IngredientForm[] = ["fresh", "frozen", "canned", "jarred", "dried"];

/** Garde de type : `x` est une forme d'ingrédient connue. */
export function isIngredientForm(x: unknown): x is IngredientForm {
  return typeof x === "string" && x in INGREDIENT_FORMS;
}

/**
 * Normalise une liste de formes : ne garde que les formes connues, dédoublonne et
 * remet dans l'ordre d'affichage canonique.
 *
 * @param forms - Formes brutes (potentiellement inconnues, en double ou désordonnées).
 * @returns Les formes valides, uniques, ordonnées.
 */
export function normalizePreferredForms(forms: readonly unknown[]): IngredientForm[] {
  const seen = new Set<IngredientForm>();
  for (const f of forms) if (isIngredientForm(f)) seen.add(f);
  return FORM_ORDER.filter(f => seen.has(f));
}

/**
 * Libellé court d'une liste de formes préférées, présenté comme une recommandation
 * (« Frais ou surgelé recommandé »). Vide si aucune forme valide.
 *
 * @param forms - Formes à afficher.
 * @returns Le libellé (chaîne vide si rien à recommander).
 */
export function formatPreferredForms(forms: readonly IngredientForm[]): string {
  const clean = normalizePreferredForms(forms);
  if (!clean.length) return "";
  const words = clean.map(f => INGREDIENT_FORMS[f]);
  const joined = words.length === 1 ? words[0] : `${words.slice(0, -1).join(", ")} ou ${words[words.length - 1]}`;
  return `${joined.charAt(0).toUpperCase()}${joined.slice(1)} recommandé`;
}

/** Recommandation résolue et prête à afficher (formes nettoyées, libellé dérivé). */
export interface ResolvedRecommendation {
  forms: IngredientForm[];
  label: string;
  message?: string;
}

/**
 * Extrait la recommandation qualité affichable d'un ingrédient de la base. Retourne
 * `null` quand l'ingrédient n'en a pas (cas majoritaire) ou que ses formes préférées
 * sont vides/inconnues : l'appelant n'affiche alors rien.
 *
 * @param item - Ingrédient de la base (ou une valeur nulle/indéfinie).
 * @returns La recommandation résolue, ou `null` s'il n'y a rien à recommander.
 */
export function resolveQualityRecommendation(item: IngredientDbItem | null | undefined): ResolvedRecommendation | null {
  const rec: QualityRecommendation | undefined = item?.qualityRecommendation;
  if (!rec || !Array.isArray(rec.preferredForms)) return null;
  const forms = normalizePreferredForms(rec.preferredForms);
  if (!forms.length) return null;
  const message = typeof rec.message === "string" && rec.message.trim() ? rec.message.trim() : undefined;
  return { forms, label: formatPreferredForms(forms), message };
}
