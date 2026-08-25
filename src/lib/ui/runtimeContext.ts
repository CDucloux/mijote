/**
 * Détection CENTRALISÉE du contexte d'exécution de l'app, pour que l'UI adapte son
 * comportement d'un seul endroit plutôt qu'en dispersant des `isNativePlatform()` /
 * `display-mode: standalone` un peu partout.
 *
 * Quatre contextes distincts :
 * - `browser` : onglet de navigateur classique (web) ;
 * - `pwa` : PWA installée, affichée en standalone ;
 * - `capacitor-ios` / `capacitor-android` : coquille native Capacitor.
 *
 * La décision est une fonction PURE de signaux injectés ({@link detectRuntimeContext}),
 * testable sans globals ; la lecture des signaux réels ({@link readRuntimeSignals})
 * est la seule glue impure.
 *
 * @module runtimeContext
 */
import { Capacitor } from "@capacitor/core";

/** Contexte d'exécution de l'app. */
export type RuntimeContext = "browser" | "pwa" | "capacitor-ios" | "capacitor-android";

/** Signaux bruts nécessaires à la décision, isolés pour la testabilité. */
export interface RuntimeSignals {
  /** Exécution dans la coquille Capacitor (`Capacitor.isNativePlatform()`). */
  isNative: boolean;
  /** Plateforme rapportée par Capacitor : `"ios"`, `"android"` ou `"web"`. */
  platform: string;
  /** PWA installée / affichage standalone (media query ou `navigator.standalone`). */
  standalone: boolean;
}

/**
 * Contexte d'exécution déduit de signaux injectés. Le natif prime (une app Capacitor
 * peut aussi rapporter standalone), puis le standalone (PWA), sinon navigateur.
 *
 * @param s - Les signaux d'exécution.
 * @returns Le contexte correspondant.
 */
export function detectRuntimeContext(s: RuntimeSignals): RuntimeContext {
  if (s.isNative) return s.platform === "ios" ? "capacitor-ios" : "capacitor-android";
  if (s.standalone) return "pwa";
  return "browser";
}

/** Le contexte est-il une coquille native Capacitor (iOS ou Android) ? */
export function isCapacitorContext(ctx: RuntimeContext): boolean {
  return ctx === "capacitor-ios" || ctx === "capacitor-android";
}

/** Contexte « application » (PWA installée ou Capacitor) vs simple onglet web ? */
export function isAppContext(ctx: RuntimeContext): boolean {
  return ctx !== "browser";
}

/**
 * Faut-il proposer le lien « Découvrir Cardamome » (vers la landing) ? Uniquement
 * dans un navigateur : en PWA/Capacitor, la landing ne doit jamais s'ouvrir comme un
 * écran interne de l'app.
 *
 * @param ctx - Le contexte d'exécution.
 * @returns `true` seulement en contexte navigateur.
 */
export function showsDiscoverLink(ctx: RuntimeContext): boolean {
  return ctx === "browser";
}

/** Lit les signaux d'exécution réels (Capacitor + affichage). Impur (globals/DOM). */
export function readRuntimeSignals(): RuntimeSignals {
  const standalone =
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true)) ||
    false;
  return {
    isNative: Capacitor.isNativePlatform(),
    platform: Capacitor.getPlatform(),
    standalone,
  };
}

/** Contexte d'exécution courant, lu depuis l'environnement réel. */
export function getRuntimeContext(): RuntimeContext {
  return detectRuntimeContext(readRuntimeSignals());
}
