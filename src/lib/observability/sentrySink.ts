/**
 * Adaptateur Sentry de la couture d'observabilité. Il reçoit le SDK en paramètre
 * (plutôt que de l'importer) : la règle de minimisation des données se teste sans
 * Sentry, et ce module reste le seul à décider de ce qui quitte l'app.
 *
 * Minimisation (RGPD) : l'utilisateur n'est identifié que par son uid Firebase,
 * jamais par son e-mail ; aucune adresse IP n'est demandée (`sendDefaultPii` off).
 *
 * @module observability/sentrySink
 */
import type { ObservabilitySink } from "./observability.js";

/** Sous-ensemble du SDK `@sentry/react` utilisé par l'adaptateur. */
export interface SentryLike {
  captureException(error: unknown, hint?: { extra?: Record<string, unknown> }): unknown;
  addBreadcrumb(breadcrumb: { category?: string; message?: string; data?: Record<string, unknown>; level?: "info" }): void;
  setUser(user: { id: string } | null): void;
}

/**
 * Réduit l'utilisateur à son identifiant technique avant envoi.
 *
 * @param user - Utilisateur connecté, tel que fourni par l'app.
 * @returns `{ id }` seul, ou `null` si déconnecté ou sans identifiant.
 */
export function toSentryUser(user: { id: string; email?: string | null } | null): { id: string } | null {
  return user?.id ? { id: user.id } : null;
}

/**
 * Construit le sink qui relaie erreurs, fils d'Ariane et utilisateur vers Sentry.
 *
 * @param sentry - Le SDK Sentry (ou un double de test).
 * @returns Le sink à passer à `initObservability`.
 */
export function createSentrySink(sentry: SentryLike): ObservabilitySink {
  return {
    captureError: (error, context) => { sentry.captureException(error, context ? { extra: context } : undefined); },
    captureEvent: (name, data) => sentry.addBreadcrumb({ category: "app", message: name, data, level: "info" }),
    setUser: user => sentry.setUser(toSentryUser(user)),
  };
}
