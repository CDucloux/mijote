/**
 * Logique de l'appel à l'action (CTA) de la landing publique. La landing s'adresse
 * aussi bien à un visiteur déconnecté qu'à une personne déjà connectée qui revient
 * lire la page : le CTA principal doit donc s'adapter à l'état d'authentification
 * plutôt que renvoyer tout le monde vers la connexion. Décision PURE (aucune I/O,
 * aucun React) pour rester testable et hors du JSX.
 *
 * @module landing/cta
 */

/** Cible d'un appel à l'action : le libellé affiché et la route de destination. */
export interface LandingCta {
  /** Texte du bouton, dans la voix de Cardamome. */
  label: string;
  /** Route interne vers laquelle naviguer au clic. */
  to: string;
}

/**
 * Forme minimale d'un utilisateur authentifié suffisante pour décider du CTA. On
 * ne dépend pas du type Firebase complet : seule la présence d'un `uid` compte.
 */
export type AuthLike = { uid?: string } | null | undefined;

/**
 * Décide du CTA principal de la landing selon l'état d'authentification.
 *
 * - Connecté : « Ouvrir Cardamome » vers l'accueil de l'app (`/home`).
 * - Déconnecté (ou auth non encore résolue) : « Essayer Cardamome » vers `/login`.
 *
 * L'état non résolu (`undefined`) est traité comme déconnecté : la landing peut se
 * peindre immédiatement sans attendre Firebase, le CTA basculera si l'utilisateur
 * se révèle connecté.
 *
 * @param user - Utilisateur courant (`undefined` tant que l'auth se résout, `null` si déconnecté).
 * @returns Le libellé et la destination du bouton principal.
 */
export function landingPrimaryCta(user: AuthLike): LandingCta {
  return user?.uid
    ? { label: "Ouvrir Cardamome", to: "/home" }
    : { label: "Essayer Cardamome", to: "/login" };
}
