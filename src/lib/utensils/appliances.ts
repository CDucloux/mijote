/**
 * Paramètres de fonctionnement des appareils (four, air fryer, blender…).
 *
 * Deux niveaux, séparés à dessein :
 * - le SCHÉMA (quels réglages un appareil expose) est figé ici, en dur, par
 *   appareil connu : c'est une taxonomie fermée, comme les catégories d'ustensiles.
 * - les VALEURS (« four à 180 °C ») vivent au niveau de l'étape
 *   (`Step.utensilParams`), pas sur la base d'ustensiles : deux étapes d'une même
 *   recette peuvent régler le même four à des températures différentes.
 *
 * Un ustensile devient « appareil » quand sa ligne de base porte un `appliance`
 * dont la clé existe ici (`APPLIANCE_SCHEMAS`).
 *
 * @module utensils/appliances
 */

/** Nature d'un réglage : nombre borné, choix fermé, ou interrupteur. */
export type ParamKind = "number" | "enum" | "bool";

/** Choix d'un réglage `enum` (valeur stockée + libellé affiché). */
export interface ParamOption {
  value: string;
  label: string;
}

/**
 * Définition d'un réglage exposé par un appareil. `unit`/`min`/`max`/`step`
 * concernent `number` ; `options` concerne `enum`.
 */
export interface ParamField {
  key: string;
  label: string;
  kind: ParamKind;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: ParamOption[];
}

/** Libellés humains des appareils connus. La clé sert d'identifiant stable. */
export const APPLIANCE_LABELS = {
  four: "Four",
  air_fryer: "Air fryer",
  blender: "Blender",
  robot_patissier: "Robot pâtissier",
  batteur: "Batteur électrique",
  mixeur_plongeant: "Mixeur plongeant",
  cuiseur_riz: "Cuiseur à riz",
} as const;

/** Clé d'un appareil connu (l'une des entrées de {@link APPLIANCE_LABELS}). */
export type ApplianceKey = keyof typeof APPLIANCE_LABELS;

// Réglages mutualisés (factorisés dès la 2ᵉ occurrence).
const VITESSE_3: ParamOption[] = [
  { value: "lente", label: "Lente" },
  { value: "moyenne", label: "Moyenne" },
  { value: "rapide", label: "Rapide" },
];

const duree = (max: number, unit: string, step = 1): ParamField =>
  ({ key: "duree", label: "Durée", kind: "number", unit, min: 0, max, step });

/**
 * Schéma de réglages par appareil connu. L'ORDRE des champs est aussi celui du
 * résumé affiché ({@link formatParamSummary}) et de l'éditeur.
 */
export const APPLIANCE_SCHEMAS: Record<ApplianceKey, ParamField[]> = {
  four: [
    { key: "prechauffage", label: "Préchauffage", kind: "bool" },
    { key: "temperature", label: "Température", kind: "number", unit: "°C", min: 0, max: 300, step: 5 },
    { key: "mode", label: "Mode", kind: "enum", options: [
      { value: "tournante", label: "Chaleur tournante" },
      { value: "statique", label: "Traditionnel" },
      { value: "gril", label: "Gril" },
      { value: "sole_voute", label: "Sole + voûte" },
    ] },
    duree(600, "min"),
  ],
  air_fryer: [
    { key: "prechauffage", label: "Préchauffage", kind: "bool" },
    { key: "temperature", label: "Température", kind: "number", unit: "°C", min: 0, max: 240, step: 5 },
    duree(120, "min"),
  ],
  blender: [
    { key: "vitesse", label: "Vitesse", kind: "enum", options: [
      { value: "min", label: "Vitesse min" },
      { value: "moyenne", label: "Vitesse moyenne" },
      { value: "max", label: "Vitesse max" },
      { value: "pulse", label: "Pulse" },
    ] },
    duree(600, "s", 5),
  ],
  robot_patissier: [
    { key: "accessoire", label: "Accessoire", kind: "enum", options: [
      { value: "fouet", label: "Fouet" },
      { value: "feuille", label: "Feuille (K)" },
      { value: "crochet", label: "Crochet" },
    ] },
    { key: "vitesse", label: "Vitesse", kind: "enum", options: VITESSE_3 },
    duree(120, "min"),
  ],
  batteur: [
    { key: "vitesse", label: "Vitesse", kind: "enum", options: VITESSE_3 },
    duree(60, "min"),
  ],
  mixeur_plongeant: [
    { key: "vitesse", label: "Vitesse", kind: "enum", options: [
      { value: "lente", label: "Lente" },
      { value: "moyenne", label: "Moyenne" },
      { value: "rapide", label: "Rapide" },
      { value: "pulse", label: "Pulse" },
    ] },
    duree(300, "s", 5),
  ],
  cuiseur_riz: [
    { key: "programme", label: "Programme", kind: "enum", options: [
      { value: "blanc", label: "Riz blanc" },
      { value: "complet", label: "Riz complet" },
      { value: "vapeur", label: "Vapeur" },
      { value: "mijotage", label: "Mijotage" },
    ] },
    duree(180, "min"),
  ],
};

/** Vrai si `x` est la clé d'un appareil connu (narrowing pour l'accès au schéma). */
export function isApplianceKey(x: unknown): x is ApplianceKey {
  return typeof x === "string" && x in APPLIANCE_SCHEMAS;
}

/**
 * Schéma de réglages d'un appareil. Retourne un tableau vide (jamais `undefined`)
 * pour un ustensile sans appareil ou inconnu : le côté appelant peut toujours
 * itérer sans garde.
 *
 * @param appliance - Clé d'appareil (ou valeur libre venant de la base / du réseau).
 */
export function getApplianceSchema(appliance: unknown): ParamField[] {
  return isApplianceKey(appliance) ? APPLIANCE_SCHEMAS[appliance] : [];
}

// Coerce une valeur brute (nombre, ou chaîne numérique) en nombre fini, sinon NaN.
function toFiniteNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
}

/**
 * Valide et nettoie des valeurs de réglages contre le schéma de l'appareil.
 * Tolérant aux entrées externes (`unknown`, Firestore) : les valeurs vides/absentes
 * sont ignorées (tous les réglages sont optionnels), les clés hors schéma sont
 * écartées, les nombres sont coercés depuis une chaîne le cas échéant. Une valeur
 * fournie mais invalide (hors bornes, choix inconnu, mauvais type) est signalée
 * dans `errors` et exclue de `values`.
 *
 * @param appliance - Clé d'appareil (schéma). Inconnu → aucun réglage retenu.
 * @param values - Valeurs candidates, indexées par clé de réglage.
 * @returns `{ values, errors }` : `values` ne contient que les réglages valides.
 */
export function validateParamValues(
  appliance: unknown,
  values: Record<string, unknown> | null | undefined,
): { values: Record<string, unknown>; errors: string[] } {
  const schema = getApplianceSchema(appliance);
  const src = values && typeof values === "object" ? values : {};
  const cleaned: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const field of schema) {
    const v = src[field.key];
    if (v == null || v === "") continue;

    if (field.kind === "number") {
      const n = toFiniteNumber(v);
      if (!Number.isFinite(n)) { errors.push(`« ${field.label} » : nombre attendu.`); continue; }
      if (field.min != null && n < field.min) { errors.push(`« ${field.label} » : minimum ${field.min}.`); continue; }
      if (field.max != null && n > field.max) { errors.push(`« ${field.label} » : maximum ${field.max}.`); continue; }
      cleaned[field.key] = n;
    } else if (field.kind === "enum") {
      const s = typeof v === "string" ? v : "";
      if (!field.options?.some(o => o.value === s)) { errors.push(`« ${field.label} » : choix inconnu « ${String(v)} ».`); continue; }
      cleaned[field.key] = s;
    } else {
      if (typeof v !== "boolean") { errors.push(`« ${field.label} » : booléen attendu.`); continue; }
      if (v) cleaned[field.key] = true; // false = absent (rien à afficher)
    }
  }
  return { values: cleaned, errors };
}

// Rend un champ unique en jeton lisible (« 180 °C », « Chaleur tournante », « Préchauffage »).
function formatField(field: ParamField, value: unknown): string {
  if (field.kind === "number") return field.unit ? `${value} ${field.unit}` : String(value);
  if (field.kind === "enum") return field.options?.find(o => o.value === value)?.label || "";
  return field.label; // bool vrai : le libellé se suffit
}

/**
 * Résumé humain, compact et ordonné, des réglages d'un appareil pour une étape
 * (ex : « Préchauffage · 180 °C · Chaleur tournante »). Ne retient que les valeurs
 * valides (validation interne). Vide si aucun réglage n'est posé.
 *
 * @param appliance - Clé d'appareil (schéma + ordre d'affichage).
 * @param values - Valeurs posées sur l'étape pour cet appareil.
 * @returns Les jetons joints par « · », ou une chaîne vide.
 */
export function formatParamSummary(
  appliance: unknown,
  values: Record<string, unknown> | null | undefined,
): string {
  const { values: clean } = validateParamValues(appliance, values);
  return getApplianceSchema(appliance)
    .filter(f => f.key in clean)
    .map(f => formatField(f, clean[f.key]))
    .filter(Boolean)
    .join(" · ");
}
