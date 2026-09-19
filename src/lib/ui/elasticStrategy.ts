import { getRuntimeContext, type RuntimeContext } from "@/lib/ui/runtimeContext.js";

/**
 * Choix de la mécanique d'overscroll élastique selon la plateforme.
 *
 * Le fond du problème : un corps défilant INTERNE (`overflow-y:auto` dans un shell à
 * hauteur fixe) n'a PAS de rebond natif sur iOS/WebKit (seul le document rebondit),
 * d'où l'effet réimplémenté en JS. Mais Android (WebView 12+ comme Chrome mobile)
 * fait nativement le « stretch overscroll » sur ces mêmes corps internes, sur le
 * thread compositeur : y superposer un pilotage JS (touchmove non passif) ne fait
 * qu'ajouter du jank. On ne garde donc le custom que là où la plateforme n'offre
 * rien (iOS) et on laisse le natif partout ailleurs.
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
 * @returns `custom` sur iOS (natif absent sur les scrollers internes), sinon `native`.
 */
export function elasticStrategy(ctx: RuntimeContext, isIOS: boolean): ElasticStrategy {
  if (ctx === "capacitor-ios") return "custom";
  if (ctx === "capacitor-android") return "native";
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
