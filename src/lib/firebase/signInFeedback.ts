/**
 * Traduction PURE d'une issue de connexion ({@link SignInOutcome}) en retour visible :
 * message et ton. Séparé du composant pour être testable et garder une seule voix de
 * copie. Aucune dépendance à Firebase ni au DOM.
 *
 * @module signInFeedback
 */
import type { SignInOutcome } from "@/lib/firebase/authErrors.js";

/** Ton d'un retour de connexion, qui pilote la couleur et le `role` ARIA côté UI. */
export type SignInTone = "ok" | "info" | "error";

/** Un retour prêt à afficher : le ton et son message. */
export interface SignInFeedback {
  tone: SignInTone;
  message: string;
}

/** Message affiché pendant l'ouverture du flux Google (bouton occupé). */
export const SIGN_IN_LOADING_MESSAGE = "Ouverture de Google…";

/**
 * Message et ton pour une issue de connexion, ou `null` quand il n'y a rien à
 * afficher (redirection plein écran en cours : la page va se recharger).
 *
 * @param outcome - L'issue renvoyée par le service de connexion.
 * @returns Le retour à afficher, ou `null`.
 */
export function signInFeedback(outcome: SignInOutcome): SignInFeedback | null {
  switch (outcome.status) {
    case "success":
      return { tone: "ok", message: "Atelier retrouvé." };
    case "redirect":
      return null;
    case "cancelled":
      return { tone: "info", message: "Connexion annulée. Ton atelier t'attend ici." };
    case "error":
      switch (outcome.reason) {
        case "network":
          return {
            tone: "error",
            message: "Impossible de joindre Google pour le moment. Vérifie ta connexion puis réessaie.",
          };
        case "unauthorized":
          return { tone: "error", message: "Ce compte n'est pas autorisé à rejoindre cet atelier." };
        case "config":
        case "generic":
        default:
          return {
            tone: "error",
            message: "La connexion est momentanément indisponible. Réessaie un peu plus tard.",
          };
      }
    default:
      return null;
  }
}
