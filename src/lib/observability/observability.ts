/**
 * Couture d'observabilité VENDOR-AGNOSTIQUE.
 *
 * Toute l'app remonte ses erreurs/événements ici, jamais directement à un
 * fournisseur. Brancher (ou changer) Sentry / GlitchTip / autre = enregistrer un
 * `ObservabilitySink` via {@link initObservability}, sans toucher au reste du code.
 *
 * Phase 1 (Sentry) — exemple de branchement dans `main.jsx`, une fois le DSN en
 * place (`VITE_SENTRY_DSN`) :
 * ```ts
 * import * as Sentry from "@sentry/react";
 * Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN, tracesSampleRate: 0.1 });
 * initObservability({
 *   captureError: (e, ctx) => Sentry.captureException(e, { extra: ctx }),
 *   captureEvent: (n, d) => Sentry.addBreadcrumb({ message: n, data: d }),
 *   setUser: (u) => Sentry.setUser(u),
 * });
 * ```
 *
 * @module observability
 */

/** Destination des signaux (implémentée par le fournisseur choisi). */
export interface ObservabilitySink {
  captureError(error: unknown, context?: Record<string, unknown>): void;
  captureEvent?(name: string, data?: Record<string, unknown>): void;
  setUser?(user: { id: string; email?: string | null } | null): void;
}

let sink: ObservabilitySink | null = null;
const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV;

/** Enregistre la destination (Sentry…). À appeler une fois au démarrage. */
export function initObservability(s: ObservabilitySink): void {
  sink = s;
}

/**
 * Remonte une erreur. En dev : trace console lisible. En prod : transmise au sink.
 * Ne throw JAMAIS — l'observabilité ne doit pas casser l'app.
 *
 * @param error - L'erreur (Error, rejet de promesse, valeur quelconque).
 * @param context - Métadonnées ({ where, uid… }) pour retrouver l'origine.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (isDev) console.error("[obs]", context?.where ?? "", error, context ?? "");
  try { sink?.captureError(error, context); } catch { /* le reporting ne doit jamais planter */ }
}

/**
 * Trace un événement/fil d'Ariane (breadcrumb) utile au diagnostic (ex.
 * « sync:bootstrap », « import:start »). N'est PAS de l'analytics produit.
 */
export function logEvent(name: string, data?: Record<string, unknown>): void {
  if (isDev) console.debug("[obs:event]", name, data ?? "");
  try { sink?.captureEvent?.(name, data); } catch { /* ignore */ }
}

/** Associe (ou détache) l'utilisateur courant aux signaux — corrèle les erreurs. */
export function setObservabilityUser(user: { id: string; email?: string | null } | null): void {
  try { sink?.setUser?.(user); } catch { /* ignore */ }
}

let installed = false;
/**
 * Installe les filets globaux (erreurs non catchées + rejets de promesse non
 * gérés). Idempotent. À appeler une fois au démarrage de l'app.
 */
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e: ErrorEvent) => reportError(e.error ?? e.message, { where: "window.onerror" }));
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => reportError(e.reason, { where: "unhandledrejection" }));
}
