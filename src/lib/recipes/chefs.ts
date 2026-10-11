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
  /** Titre exact de l'article Wikipédia en français, absent s'il n'y en a pas. */
  wiki?: string;
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
    const wiki = typeof entry.wiki === "string" ? entry.wiki.trim() : "";
    const chef: Chef = { name };
    if (note) chef.note = note;
    if (wiki) chef.wiki = wiki;
    chefs.push(chef);
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

/** Nom découpé en mots normalisés, ponctuation retirée (« A. Escoffier » → a, escoffier). */
const words = (name: string): string[] => normalizeStr(name).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Rattache un chef extrait par l'import IA à la liste. Le LLM écrit le nom comme
 * la source le donne (« Escoffier », « A. Escoffier », « Paul Bocuse »), alors
 * que la liste fixe une graphie : on reconnaît le nom de famille, accompagné au
 * plus d'un prénom ou d'une initiale compatible. Un nom qui ne désigne pas un seul
 * chef de la liste reste tel quel (l'éditeur l'affiche « Hors liste »).
 *
 * @param chefs - Liste de référence.
 * @param raw - Chef renvoyé par l'import.
 * @returns La graphie de la liste si un seul chef correspond, sinon `raw` nettoyé.
 */
export function canonicalChef(chefs: Chef[], raw: string | null | undefined): string {
  const name = (raw ?? "").replace(/\s+/g, " ").trim();
  const exact = findChef(chefs, name);
  if (exact || !name) return exact?.name ?? "";
  const given = words(name);
  const surname = given.at(-1);
  if (!surname || given.length > 2) return name;
  const first = given.length === 2 ? given[0] : "";
  const hits = chefs.filter(chef => {
    const parts = words(chef.name);
    if (parts.at(-1) !== surname) return false;
    if (!first) return true;
    return first.length === 1 ? parts[0].startsWith(first) : parts[0] === first;
  });
  return hits.length === 1 ? hits[0].name : name;
}

/**
 * Lien vers l'article Wikipédia en français d'un chef de la liste. Seul un titre
 * renseigné à la main dans `data/chefs.yaml` produit un lien : deviner l'article
 * depuis un nom saisi mènerait vers un homonyme ou une page inexistante.
 *
 * @param chefs - Liste de référence.
 * @param name - Valeur de `recipe.chef`.
 * @returns L'URL de l'article, ou `null` (chef hors liste ou sans article).
 */
export function chefWikipediaUrl(chefs: Chef[], name: string | null | undefined): string | null {
  const title = findChef(chefs, name)?.wiki;
  return title ? `https://fr.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` : null;
}
