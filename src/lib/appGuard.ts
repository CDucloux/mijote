/**
 * Garde-fou anti-client périmé / hôte non autorisé.
 *
 * Contexte : plusieurs déploiements (prod canonique, anciens alias Vercel, onglets
 * PWA installés de longue date) partagent la MÊME base Firestore. Un client trop
 * vieux, avec un cache local obsolète, peut écraser la prod via la synchro par diff
 * (suppression de recettes absentes de son état). Ce module décide, à partir d'une
 * config distante pilotable sans redéploiement, si le client courant a le droit
 * d'écrire. La décision est PURE (aucune I/O, aucun React) et fail-open : sans config
 * exploitable, on n'entrave jamais un utilisateur légitime.
 */

/** Config distante d'admission d'un client (doc `config/app`), après validation. */
export interface AppConfig {
  /** Version minimale autorisée (semver `x.y.z`). En deçà, le client est verrouillé. */
  minimumVersion?: string;
  /** Hôtes canoniques autorisés. Vide/absent : aucun contrôle d'hôte. */
  allowedHosts?: string[];
}

/** Verdict du garde-fou : autorisé, ou bloqué avec sa raison. */
export type AppGuardVerdict =
  | { ok: true }
  | { ok: false; reason: "stale-version" | "foreign-host" };

/**
 * Parse un semver `x.y.z` en triplet numérique, en ignorant tout suffixe
 * (pré-release, build). Retourne `null` si la forme majeure.mineure.patch est
 * absente ou non numérique.
 */
function parseSemver(v: unknown): [number, number, number] | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Compare deux versions semver.
 *
 * @returns -1 si `a` < `b`, 1 si `a` > `b`, 0 si égales ; `null` si l'une des
 *          deux est illisible (le comparateur ne peut alors rien conclure).
 */
export function compareSemver(a: unknown, b: unknown): -1 | 0 | 1 | null {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

/**
 * Valide un payload distant `unknown` en `AppConfig`. Ne conserve que les champs
 * bien formés ; tout le reste est ignoré (jamais casté à l'aveugle).
 *
 * @returns Une config validée, ou `null` si le payload n'est pas exploitable
 *          (déclenche alors le comportement fail-open).
 */
export function parseAppConfig(raw: unknown): AppConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const config: AppConfig = {};
  if (parseSemver(obj.minimumVersion)) config.minimumVersion = obj.minimumVersion as string;
  if (Array.isArray(obj.allowedHosts)) {
    const hosts = obj.allowedHosts.filter((h): h is string => typeof h === "string" && h.trim() !== "");
    if (hosts.length > 0) config.allowedHosts = hosts;
  }
  return config;
}

/** Entrées du garde-fou : identité du client courant + config distante. */
export interface AppGuardInput {
  /** Version du bundle en cours d'exécution (`__APP_VERSION__`). */
  currentVersion: string;
  /** Hôte courant (`window.location.hostname`). */
  host: string;
  /** Config distante validée, ou `null` si indisponible. */
  config: AppConfig | null;
}

/**
 * Décide si le client courant est autorisé à écrire dans la base partagée.
 *
 * Fail-open par construction : config absente, version minimale illisible ou
 * allowlist vide n'entravent JAMAIS le client. On ne bloque que sur un critère
 * explicitement configuré et sans ambiguïté (version strictement antérieure au
 * minimum, ou hôte hors d'une allowlist non vide).
 */
export function evaluateAppGuard({ currentVersion, host, config }: AppGuardInput): AppGuardVerdict {
  if (!config) return { ok: true };
  if (config.minimumVersion && compareSemver(currentVersion, config.minimumVersion) === -1) {
    return { ok: false, reason: "stale-version" };
  }
  if (config.allowedHosts && !config.allowedHosts.includes(host)) {
    return { ok: false, reason: "foreign-host" };
  }
  return { ok: true };
}
