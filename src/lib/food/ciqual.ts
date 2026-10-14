/**
 * Traçabilité Ciqual d'un ingrédient : l'aliment de la table Ciqual (Anses) d'où
 * proviennent ses valeurs nutritionnelles. Porté par le champ optionnel `ciqual`
 * de la base (`{ code, name }`), il permet de pointer la fiche ingrédient vers la
 * page exacte de l'aliment sur ciqual.anses.fr. Logique pure, sans I/O ni React.
 *
 * @module food/ciqual
 */
import type { CiqualRef } from "@/lib/types";

/** Page d'accueil de la table, repli quand l'aliment source est inconnu. */
export const CIQUAL_HOME = "https://ciqual.anses.fr/";

/** Longueur maximale du nom d'aliment conservé (les noms Ciqual font < 200 car.). */
const NAME_MAX = 200;

/** Les codes Ciqual sont des entiers positifs (1 à 6 chiffres). */
const isCiqualCode = (n: number): boolean => Number.isInteger(n) && n > 0 && n < 1_000_000;

/**
 * Valide la référence Ciqual brute d'un import (YAML, Firestore). Le code est
 * accepté en nombre ou en chaîne de chiffres ; le nom de l'aliment est facultatif.
 *
 * @param raw - Valeur brute du champ `ciqual`.
 * @returns `{ ref }` si valide, sinon `{ error }` (message lisible).
 */
export function parseCiqualRef(raw: unknown): { ref?: CiqualRef; error?: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: "« ciqual » doit être un objet { code, name }." };
  const { code, name } = raw as Record<string, unknown>;
  const num = typeof code === "number" ? code : typeof code === "string" && /^\d+$/.test(code.trim()) ? Number(code.trim()) : NaN;
  if (!isCiqualCode(num)) return { error: `code Ciqual invalide « ${String(code ?? "?")} ».` };
  if (name != null && typeof name !== "string") return { error: "« ciqual.name » doit être une chaîne." };
  const label = (name || "").trim();
  if (label.length > NAME_MAX) return { error: `« ciqual.name » trop long (max ${NAME_MAX}).` };
  return { ref: label ? { code: num, name: label } : { code: num } };
}

/**
 * Segment d'URL lisible dérivé du nom Ciqual (« Cardamome, poudre » →
 * « cardamome-poudre »), sur le modèle des adresses du site.
 *
 * @param name - Nom de l'aliment dans la table.
 * @returns Le segment, vide si le nom ne contient aucun caractère exploitable.
 */
export function ciqualSlug(name: string): string {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Adresse de la fiche de l'aliment source sur ciqual.anses.fr, ou la page
 * d'accueil de la table si la référence manque ou est invalide.
 *
 * @param ref - Référence Ciqual de l'ingrédient.
 * @returns L'URL à ouvrir depuis le badge Ciqual.
 */
export function ciqualUrl(ref: CiqualRef | null | undefined): string {
  if (!ref || !isCiqualCode(ref.code)) return CIQUAL_HOME;
  const slug = ref.name ? ciqualSlug(ref.name) : "";
  return `${CIQUAL_HOME}#/aliments/${ref.code}${slug ? `/${slug}` : ""}`;
}
