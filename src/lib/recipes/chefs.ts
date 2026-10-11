/**
 * Liste fermée des chefs proposés dans l'éditeur (`data/chefs.yaml`). Un nom
 * choisi dans une liste reste identique d'une recette à l'autre, ce qui rend le
 * filtre par chef et l'attribution fiables (fini « Escoffier » / « A. Escoffier »).
 *
 * @module recipes/chefs
 */
import { normalizeStr } from "@/lib/food/parseIngredient.js";

/** Un chef de la liste. */
export interface Chef {
  /** Nom affiché et stocké tel quel dans `recipe.chef`. */
  name: string;
  /** Repère affiché sous le nom (restaurant, ville, ouvrage). */
  note?: string;
}

const MAX_NAME = 120;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Valide le contenu parsé de `data/chefs.yaml`. Les entrées malformées, trop
 * longues ou en doublon (casse et accents ignorés) sont écartées plutôt que de
 * casser l'éditeur : le fichier est embarqué, une coquille ne doit pas bloquer l'app.
 *
 * @param raw - Document YAML parsé (`{ chefs: [...] }`), non fiable.
 * @returns Les chefs valides, dans l'ordre du fichier.
 */
export function parseChefs(raw: unknown): Chef[] {
  const list = isRecord(raw) && Array.isArray(raw.chefs) ? raw.chefs : [];
  const seen = new Set<string>();
  const chefs: Chef[] = [];
  for (const entry of list) {
    if (!isRecord(entry) || typeof entry.name !== "string") continue;
    const name = entry.name.trim();
    const key = normalizeStr(name);
    if (!name || name.length > MAX_NAME || seen.has(key)) continue;
    seen.add(key);
    const note = typeof entry.note === "string" ? entry.note.trim() : "";
    chefs.push(note ? { name, note } : { name });
  }
  return chefs;
}

/**
 * Retrouve un chef de la liste par son nom, casse et accents ignorés.
 *
 * @param chefs - Liste de référence.
 * @param name - Valeur de `recipe.chef`.
 * @returns Le chef correspondant, ou `null` s'il est hors liste (import, ancienne saisie).
 */
export function findChef(chefs: Chef[], name: string | null | undefined): Chef | null {
  const key = normalizeStr(name);
  return key ? chefs.find(chef => normalizeStr(chef.name) === key) ?? null : null;
}
