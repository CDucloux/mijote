import { getRuntimeContext, type RuntimeContext } from "@/lib/ui/runtimeContext.js";

/**
 * Choix de la mécanique d'overscroll élastique selon la plateforme.
 *
 * Le fond du problème : un corps défilant INTERNE (`overflow-y:auto` dans un shell à
 * hauteur fixe) n'a PAS de rebond natif sur iOS/WebKit (seul le document rebondit).
 * Côté WebView Capacitor (iOS comme Android), le « stretch overscroll » natif ne
 * s'affiche pas de façon fiable sur ces corps internes : sans effet custom, il ne
 * reste alors RIEN. On garde donc le custom (mais ALLÉGÉ, cf. `armAtEdgeOnly`) dans les
 * coquilles Capacitor. Sur le web/PWA hors iOS (Chrome Android, desktop), le navigateur
 * fournit l'overscroll nativement, sur le thread compositeur : on le laisse faire.
 *
 * @module ui/elasticStrategy
 */

/** `native` : laisser l'overscroll natif ; `custom` : piloter l'effet en JS. */
export type ElasticStrategy = "native" | "custom";

/**
 * La plateforme est-elle iOS/iPadOS ? (Décision PURE, signaux injectés.)
 *
 * iPadOS 13+ se déguise en Mac desktop : on le rattrape via un `platform` « MacIntel »
 * doublé d'un écran tactile (`maxTouchPoints > 1`), qu'un vrai Mac n'a pas.
 *
 * @param ua - `navigator.userAgent`.
 * @param platform - `navigator.platform` (héritage, mais fiable pour le cas iPadOS).
 * @param maxTouchPoints - `navigator.maxTouchPoints`.
 * @returns `true` sur iPhone / iPad / iPod.
 */
export function isIOSPlatform(ua: string, platform: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

/**
 * Mécanique d'overscroll à employer pour un corps défilant interne. (Décision PURE.)
 *
 * @param ctx - Contexte d'exécution (cf. runtimeContext).
 * @param isIOS - La plateforme est-elle iOS/iPadOS ?
 * @returns `custom` dans les coquilles Capacitor et sur iOS web (natif absent/non
 *   fiable sur les scrollers internes), `native` sur le web/PWA hors iOS.
 */
export function elasticStrategy(ctx: RuntimeContext, isIOS: boolean): ElasticStrategy {
  if (ctx === "capacitor-ios" || ctx === "capacitor-android") return "custom";
  return isIOS ? "custom" : "native";
}

/**
 * Lit la stratégie d'overscroll depuis l'environnement réel (impur : globals/DOM).
 *
 * @returns `native` ou `custom` pour la plateforme courante.
 */
export function readElasticStrategy(): ElasticStrategy {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const isIOS = nav ? isIOSPlatform(nav.userAgent || "", nav.platform || "", nav.maxTouchPoints || 0) : false;
  return elasticStrategy(getRuntimeContext(), isIOS);
}
