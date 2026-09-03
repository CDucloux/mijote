/**
 * Découpe des légumes pour la mise en place. Trois responsabilités pures :
 *   1. un VOCABULAIRE fermé des formes de découpe ({@link FORMES}) ;
 *   2. le NARROWING de la découpe telle que renvoyée par le LLM ou lue en base
 *      (payload `unknown` → {@link Cut} validé, cf. {@link parseCut}) ;
 *   3. la DÉRIVATION des « postes de découpe » regroupés et ordonnés à partir des
 *      lignes d'ingrédients ({@link buildPostesDecoupe}).
 *
 * La même fonction de regroupement se rebranchera sur plusieurs recettes (cuisine
 * par lot) sans réécriture : elle ne fait qu'agréger des lignes d'ingrédients.
 * Aucun I/O, aucun React.
 *
 * @module decoupe
 */

import type { Calibre, Cut, FormeDecoupe, IngredientLine } from "@/lib/types.js";
import { fmtQtyUnit, pluralizeName } from "@/lib/format.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { normTech, type TechniqueEntry, type TechniqueIndex } from "@/lib/recipes/techniques.js";

/** Vocabulaire canonique, dans l'ordre de mise en place (gestes regroupés). Cet
 *  ordre sert aussi de tri par défaut des postes. À garder synchronisé avec le
 *  prompt d'import (`functions/prompts/recipeExtract.md`). */
export const FORMES: readonly FormeDecoupe[] = [
  "rape", "emince", "cisele", "hache", "chiffonade",
  "des", "brunoise", "mirepoix", "paysanne", "julienne", "batonnet",
  "rondelle", "troncon", "quartier",
];

/** Libellé impératif d'un geste, pour une ligne de check-list (« Ciseler : 3 oignons »).
 *  Le `Record` exhaustif garde le vocabulaire complet : un ajout à {@link FormeDecoupe}
 *  sans libellé casse la compilation. */
export const FORME_LABEL: Record<FormeDecoupe, string> = {
  emince: "Émincer",
  cisele: "Ciseler",
  des: "Tailler en dés",
  brunoise: "Tailler en brunoise",
  mirepoix: "Tailler en mirepoix",
  paysanne: "Tailler en paysanne",
  julienne: "Tailler en julienne",
  batonnet: "Tailler en bâtonnets",
  rondelle: "Détailler en rondelles",
  troncon: "Détailler en tronçons",
  quartier: "Tailler en quartiers",
  rape: "Râper",
  hache: "Hacher",
  chiffonade: "Ciseler en chiffonade",
};

/** Phrases candidates pour relier une forme au glossaire des gestes ({@link TechniqueIndex}) :
 *  la plus spécifique d'abord, repli sur le mot nu. */
const FORME_GESTE: Record<FormeDecoupe, string[]> = {
  emince: ["émincer"],
  cisele: ["ciseler"],
  des: ["tailler en dés", "dés"],
  brunoise: ["tailler en brunoise", "brunoise"],
  mirepoix: ["tailler en mirepoix", "mirepoix"],
  paysanne: ["tailler en paysanne", "paysanne"],
  julienne: ["tailler en julienne", "julienne"],
  batonnet: ["tailler en bâtonnets", "bâtonnets"],
  rondelle: ["détailler en rondelles", "rondelles"],
  troncon: ["détailler en tronçons", "tronçons"],
  quartier: ["tailler en quartiers", "quartiers"],
  rape: ["râper"],
  hache: ["hacher"],
  chiffonade: ["ciseler en chiffonade", "chiffonade"],
};

/** Légumes salissants/odorants relégués en fin de mise en place (planche gardée propre). */
const SALISSANTS = new Set([
  "ail", "echalote", "gingembre", "piment", "persil", "coriandre", "ciboulette",
  "basilic", "menthe", "aneth", "estragon", "cerfeuil", "oseille",
]);

/** Normalisation d'une formulation libre pour l'appariement (accents/casse ignorés, espaces compactés). */
const normPhrase = (s: string): string => normalizeStr(s).replace(/\s+/g, " ");

/** Table alias → forme canonique (clés déjà normalisées, sans accent). */
const FORME_ALIASES: Record<string, FormeDecoupe> = (() => {
  const raw: Record<FormeDecoupe, string[]> = {
    emince: ["émincer", "émincé", "émincés", "émincé fin", "en lamelles", "lamelles", "fines lamelles", "en fines lamelles", "tranches fines", "en fines tranches"],
    cisele: ["ciseler", "ciselé", "ciselés", "ciselé fin", "ciselé finement"],
    des: ["dés", "en dés", "cubes", "en cubes", "coupé en dés", "petits dés", "dés moyens", "gros dés", "macédoine"],
    brunoise: ["brunoise", "en brunoise", "très petits dés"],
    mirepoix: ["mirepoix", "en mirepoix"],
    paysanne: ["paysanne", "en paysanne"],
    julienne: ["julienne", "en julienne", "tailler en julienne", "filaments"],
    batonnet: ["bâtonnet", "bâtonnets", "en bâtonnets", "bâtons", "jardinière"],
    rondelle: ["rondelle", "rondelles", "en rondelles", "tranches", "en tranches", "rouelles"],
    troncon: ["tronçon", "tronçons", "en tronçons", "sifflet", "en sifflet", "biseau", "en biseau"],
    quartier: ["quartier", "quartiers", "en quartiers"],
    rape: ["râper", "râpé", "râpés", "râpée", "en fils"],
    hache: ["hacher", "haché", "hachés", "haché menu", "en hachis"],
    chiffonade: ["chiffonade", "en chiffonade"],
  };
  const map: Record<string, FormeDecoupe> = {};
  for (const forme of FORMES) {
    map[forme] = forme; // l'identité canonique reste un alias valide
    for (const alias of raw[forme]) map[normPhrase(alias)] = forme;
  }
  return map;
})();

/** Parse un calibre grossier ; synonymes courants ramenés à fin/moyen/gros. */
function parseCalibre(raw: unknown): Calibre | undefined {
  if (typeof raw !== "string") return undefined;
  const n = normPhrase(raw);
  if (n === "fin" || n === "petit" || n === "petite") return "fin";
  if (n === "moyen" || n === "moyenne") return "moyen";
  if (n === "gros" || n === "grosse" || n === "grand" || n === "grande") return "gros";
  return undefined;
}

/**
 * Valide une découpe venue de l'extérieur (réponse LLM, doc Firestore) : accepte une
 * chaîne (« émincé »), un objet `{ forme, calibre }`, ou leurs variantes libres, et
 * ramène le tout au vocabulaire fermé. N'invente jamais : toute forme inconnue rend
 * `null`, ce qui exclut simplement la ligne de la mise en place.
 *
 * @param raw - Payload brut, de forme inconnue.
 * @returns La découpe canonique, ou `null` si non reconnue.
 */
export function parseCut(raw: unknown): Cut | null {
  let formeRaw: unknown;
  let calibreRaw: unknown;
  if (typeof raw === "string") {
    formeRaw = raw;
  } else if (raw && typeof raw === "object") {
    formeRaw = (raw as Record<string, unknown>).forme;
    calibreRaw = (raw as Record<string, unknown>).calibre;
  } else {
    return null;
  }
  if (typeof formeRaw !== "string") return null;
  const forme = FORME_ALIASES[normPhrase(formeRaw)];
  if (!forme) return null;
  const calibre = parseCalibre(calibreRaw);
  return calibre ? { forme, calibre } : { forme };
}

/** Un poste de mise en place : un même geste appliqué à un même légume, quantités agrégées. */
export interface PosteDecoupe {
  /** Clé stable (légume + forme + calibre + unité) : cochage et déduplication. */
  key: string;
  forme: FormeDecoupe;
  calibre: Calibre | null;
  /** Nom d'ingrédient au singulier canonique (première ligne du groupe). */
  name: string;
  /** Quantité totale agrégée, ou `null` si les lignes ne sont pas toutes sommables (unités hétérogènes). */
  amount: number | null;
  /** Unité canonique commune au groupe (`""` = à la pièce). */
  unit: string;
  /** Ids des lignes d'ingrédients regroupées (liaison + cochage). */
  ingredientIds: string[];
  /** Geste correspondant dans le glossaire, si un index est fourni et le geste connu. */
  technique: TechniqueEntry | null;
}

/** Convertit une quantité (nombre ou saisie « 1,5 ») en nombre fini, sinon `null`. */
function num(v: number | string | undefined): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Repère un geste dans l'index à partir des phrases candidates de la forme. */
function findTechnique(forme: FormeDecoupe, index: TechniqueIndex | null | undefined): TechniqueEntry | null {
  if (!index || index.phrases.size === 0) return null;
  for (const phrase of FORME_GESTE[forme]) {
    const hit = index.phrases.get(normTech(phrase));
    if (hit) return hit;
  }
  return null;
}

interface Bucket {
  forme: FormeDecoupe;
  calibre: Calibre | null;
  name: string;
  unit: string;
  ids: string[];
  amounts: (number | null)[];
}

/**
 * Dérive les postes de mise en place à partir de lignes d'ingrédients : ne retient que
 * celles qui portent une découpe reconnue, REGROUPE par (légume, forme, calibre, unité)
 * en sommant les quantités homogènes, et ORDONNE les postes (gestes regroupés, légumes
 * salissants en dernier pour garder la planche propre).
 *
 * @param ings - Les lignes d'ingrédients (d'une ou, à terme, plusieurs recettes).
 * @param techniqueIndex - Glossaire des gestes, pour lier chaque poste à sa technique (optionnel).
 * @returns Les postes de découpe, prêts à afficher/cocher, triés.
 */
export function buildPostesDecoupe(
  ings: readonly IngredientLine[] | null | undefined,
  techniqueIndex?: TechniqueIndex | null,
): PosteDecoupe[] {
  const buckets = new Map<string, Bucket>();

  for (const line of ings || []) {
    const cut = parseCut(line?.cut);
    if (!cut) continue;
    const name = (line.name || "").trim();
    if (!name) continue;
    const unit = (line.unit || "").trim();
    const calibre = cut.calibre ?? null;
    const key = [normalizeStr(line.dbId || name), cut.forme, calibre || "", normalizeStr(unit)].join("|");

    let b = buckets.get(key);
    if (!b) {
      b = { forme: cut.forme, calibre, name, unit, ids: [], amounts: [] };
      buckets.set(key, b);
    }
    if (line.id) b.ids.push(line.id);
    b.amounts.push(num(line.amount));
  }

  const postes: PosteDecoupe[] = [];
  for (const [key, b] of buckets) {
    // Somme fiable seulement si CHAQUE ligne du groupe porte une quantité numérique.
    const allNum = b.amounts.length > 0 && b.amounts.every((a) => a != null);
    const amount = allNum ? b.amounts.reduce((s: number, a) => s + (a as number), 0) : null;
    postes.push({
      key, forme: b.forme, calibre: b.calibre, name: b.name, amount, unit: b.unit,
      ingredientIds: b.ids,
      technique: findTechnique(b.forme, techniqueIndex),
    });
  }

  const order = new Map(FORMES.map((f, i) => [f, i]));
  const salissant = (name: string): number =>
    normalizeStr(name).split(" ").some((w) => SALISSANTS.has(w)) ? 1 : 0;
  postes.sort((a, b) =>
    (salissant(a.name) - salissant(b.name)) ||
    ((order.get(a.forme) ?? 0) - (order.get(b.forme) ?? 0)) ||
    a.name.localeCompare(b.name, "fr"),
  );
  return postes;
}

/**
 * Libellé de check-list d'un poste : geste impératif, calibre entre parenthèses, puis
 * la quantité et le légume accordés (« Ciseler : 3 oignons », « Râper : 200 g carotte »).
 *
 * @param poste - Le poste de découpe.
 * @returns Le libellé prêt à afficher.
 */
export function posteLabel(poste: PosteDecoupe): string {
  const geste = FORME_LABEL[poste.forme];
  const cal = poste.calibre ? ` (${poste.calibre})` : "";
  let quoi: string;
  if (poste.amount != null) {
    quoi = poste.unit
      ? `${fmtQtyUnit(poste.amount, poste.unit)} ${poste.name}`
      : `${poste.amount} ${pluralizeName(poste.amount, poste.name)}`;
  } else {
    quoi = poste.name;
  }
  return `${geste}${cal} : ${quoi}`;
}
