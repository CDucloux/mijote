/**
 * Cuisiner à deux : minuteurs communs de la session.
 *
 * Les minuteurs vivent dans le document de session (`timers.<id>`), sous forme
 * horodatée : chaque appareil en dérive le restant avec sa propre horloge, l'état
 * « terminé » n'est donc jamais publié mais recalculé localement. L'étape source
 * voyage par sa clé de page (cf. `pageKeyOf`) et non par son index, qui peut
 * différer d'un appareil à l'autre (page « Bases » présente ou non).
 *
 * @module cookSession/sharedTimers
 */
import { hasElapsed, markDone, type CookTimer } from "@/lib/planning/cookTimers.js";

/** Minuteur tel que publié dans la session. */
export interface SharedTimerEntry {
  label: string;
  totalSec: number;
  running: boolean;
  endAt: number | null;
  remainingMs: number;
  /** Clé de la page source (`step:2`, `overview`…). */
  page: string;
  stepLabel: string;
  /** Uid du membre qui l'a lancé. */
  startedBy: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Forme publiable d'un minuteur (sans champ `undefined`, refusé par Firestore).
 *
 * @param timer - Minuteur local.
 * @param page - Clé de la page source du minuteur.
 * @param startedBy - Uid du lanceur, retenu si le minuteur n'en porte pas déjà un.
 * @returns L'entrée à écrire sous `timers.<id>`.
 */
export function toSharedTimerEntry(timer: CookTimer, page: string, startedBy: string): SharedTimerEntry {
  return {
    label: timer.label,
    totalSec: timer.totalSec,
    running: timer.running && !timer.done,
    endAt: timer.done ? null : timer.endAt,
    remainingMs: timer.done ? 0 : timer.remainingMs,
    page,
    stepLabel: timer.stepLabel,
    startedBy: timer.startedBy || startedBy,
  };
}

function parseEntry(id: string, raw: unknown, pageKeys: readonly string[]): CookTimer | null {
  if (!id || !isRecord(raw) || !isNum(raw.totalSec) || raw.totalSec <= 0) return null;
  const running = raw.running === true;
  const endAt = isNum(raw.endAt) ? raw.endAt : null;
  if (running && endAt === null) return null;
  const stepIdx = pageKeys.indexOf(typeof raw.page === "string" ? raw.page : "");
  return {
    id,
    label: typeof raw.label === "string" ? raw.label : "",
    totalSec: raw.totalSec,
    running,
    endAt: running ? endAt : null,
    remainingMs: isNum(raw.remainingMs) ? Math.max(0, raw.remainingMs) : 0,
    done: false,
    stepIdx: Math.max(0, stepIdx),
    stepLabel: typeof raw.stepLabel === "string" ? raw.stepLabel : "",
    ...(typeof raw.startedBy === "string" && raw.startedBy ? { startedBy: raw.startedBy } : {}),
  };
}

/**
 * Lit les minuteurs d'un document de session (donnée externe). Les entrées
 * malformées sont ignorées une à une ; une page source inconnue ici retombe sur la
 * première page.
 *
 * @param rawSession - Document de session brut.
 * @param pageKeys - Clés des pages du pas à pas local, dans l'ordre.
 * @returns Les minuteurs, triés par identifiant (ordre stable entre appareils).
 */
export function parseSharedTimers(rawSession: unknown, pageKeys: readonly string[]): CookTimer[] {
  if (!isRecord(rawSession) || !isRecord(rawSession.timers)) return [];
  return Object.entries(rawSession.timers)
    .map(([id, raw]) => parseEntry(id, raw, pageKeys))
    .filter((t): t is CookTimer => t !== null)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Résultat de {@link mergeSharedTimers}. */
export interface SharedTimersMerge {
  /** Minuteurs à afficher localement. */
  timers: CookTimer[];
  /** Minuteurs locaux encore jamais publiés (lancés avant la jonction) : à publier. */
  pending: CookTimer[];
}

/**
 * Fusionne la liste locale avec celle de la session. La session fait foi pour
 * tout minuteur qu'elle connaît ; un minuteur local déjà vu dans la session puis
 * disparu a été arrêté par l'autre membre et tombe ; un minuteur local jamais vu
 * est en attente de publication et reste. L'ordre local est conservé, les
 * nouveaux minuteurs de l'autre membre arrivent à la suite.
 *
 * @param local - Minuteurs affichés localement.
 * @param shared - Minuteurs lus dans la session.
 * @param seen - Identifiants déjà vus dans la session.
 * @param now - Horloge courante (epoch ms) : un minuteur échu passe « terminé ».
 */
export function mergeSharedTimers(
  local: readonly CookTimer[], shared: readonly CookTimer[], seen: ReadonlySet<string>, now: number,
): SharedTimersMerge {
  const byId = new Map(shared.map((t) => [t.id, t]));
  const settle = (t: CookTimer): CookTimer => (hasElapsed(t, now) ? markDone(t) : t);
  const timers: CookTimer[] = [];
  const pending: CookTimer[] = [];
  for (const t of local) {
    const remote = byId.get(t.id);
    if (remote) timers.push(settle(remote));
    else if (!seen.has(t.id)) { timers.push(t); pending.push(t); }
  }
  const known = new Set(local.map((t) => t.id));
  for (const t of shared) if (!known.has(t.id)) timers.push(settle(t));
  return { timers, pending };
}
