/**
 * Cuisiner à deux : logique pure d'une session de pas à pas partagée dans le foyer.
 *
 * Une session vit dans `households/{hid}/cookSessions/{recipeId}` (une par recette).
 * Chaque membre y publie sa position (page du pas à pas) et un battement de présence ;
 * les étapes faites et la fin sont communes. Ce module ne fait aucune I/O : il valide
 * le document Firestore (donnée externe, `unknown`) et en dérive ce que l'UI affiche.
 *
 * @module cookSession/together
 */

/** Délai au-delà duquel un participant sans battement est considéré parti (ms). */
export const PRESENCE_TTL_MS = 90_000;

/** Intervalle de battement de présence recommandé (ms), bien sous le TTL. */
export const HEARTBEAT_MS = 30_000;

/** Un membre du foyer présent dans la session. */
export interface CookParticipant {
  uid: string;
  name: string;
  photoURL: string;
  /** Clé de la page où il se trouve (cf. {@link pageKeyOf}). */
  page: string;
  /** Dernier battement de présence (epoch ms, horloge du participant). */
  lastSeen: number;
}

/** Session de cuisine partagée, telle que validée depuis Firestore. */
export interface CookTogetherSession {
  recipeId: string;
  recipeName: string;
  /** Lancement de la session (epoch ms) : chrono commun aux participants. */
  startedAt: number;
  participants: CookParticipant[];
  /** Index réels (dans `recipe.steps`) des étapes marquées faites, triés. */
  doneSteps: number[];
  finished: boolean;
  /** Uid de celui qui a terminé la recette (consigne le plat une seule fois). */
  finishedBy: string | null;
}

/** Page du pas à pas, réduite à ce qui l'identifie. */
export type CookPageRef = { kind: "overview" } | { kind: "bases" } | { kind: "step"; realIdx: number };

/**
 * Clé stable d'une page, identique sur les deux appareils (les pages se déduisent
 * de la même recette) : `overview`, `bases` ou `step:<index réel>`.
 *
 * @param page - Page du pas à pas.
 * @returns La clé à publier comme position.
 */
export function pageKeyOf(page: CookPageRef): string {
  return page.kind === "step" ? `step:${page.realIdx}` : page.kind;
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Convertit un horodatage Firestore (Timestamp, nombre) en epoch ms ; 0 si illisible. */
function toMillis(v: unknown): number {
  if (typeof v === "number") return num(v);
  if (isRecord(v) && typeof v.toMillis === "function") {
    const ms: unknown = (v.toMillis as () => unknown)();
    return num(ms);
  }
  return 0;
}

function parseParticipant(uid: string, raw: unknown): CookParticipant | null {
  if (!uid || !isRecord(raw)) return null;
  const page = str(raw.page);
  if (!page) return null;
  return { uid, name: str(raw.name), photoURL: str(raw.photoURL), page, lastSeen: toMillis(raw.lastSeen) };
}

/**
 * Valide un document de session lu dans Firestore. Les participants malformés sont
 * ignorés un à un ; un document sans recette est rejeté.
 *
 * @param raw - Données brutes du document.
 * @returns La session validée, ou `null` si le document est inexploitable.
 */
export function parseCookSession(raw: unknown): CookTogetherSession | null {
  if (!isRecord(raw)) return null;
  const recipeId = str(raw.recipeId);
  if (!recipeId) return null;
  const parts = isRecord(raw.participants) ? raw.participants : {};
  const participants = Object.entries(parts)
    .map(([uid, p]) => parseParticipant(uid, p))
    .filter((p): p is CookParticipant => p !== null);
  const doneSteps = Array.isArray(raw.doneSteps)
    ? [...new Set(raw.doneSteps.filter((i): i is number => Number.isInteger(i) && i >= 0))].sort((a, b) => a - b)
    : [];
  return {
    recipeId,
    recipeName: str(raw.recipeName),
    startedAt: toMillis(raw.startedAt),
    participants,
    doneSteps,
    finished: raw.finished === true,
    finishedBy: str(raw.finishedBy) || null,
  };
}

/**
 * Participants encore présents (battement reçu depuis moins de {@link PRESENCE_TTL_MS}).
 *
 * @param session - Session validée.
 * @param now - Horloge courante (epoch ms).
 * @returns Les participants actifs, dans l'ordre du document.
 */
export function activeParticipants(session: CookTogetherSession, now: number): CookParticipant[] {
  return session.participants.filter((p) => now - p.lastSeen < PRESENCE_TTL_MS);
}

/**
 * Une session est vivante tant qu'elle n'est pas terminée et qu'au moins un membre
 * y est présent. Une session morte se réinitialise au prochain lancement.
 *
 * @param session - Session validée (ou absente).
 * @param now - Horloge courante (epoch ms).
 * @returns `true` si on peut la rejoindre en l'état.
 */
export function isSessionLive(session: CookTogetherSession | null, now: number): boolean {
  return !!session && !session.finished && activeParticipants(session, now).length > 0;
}

/**
 * Autres membres présents, regroupés par page : sert à poser leur avatar sur
 * l'étape où ils se trouvent.
 *
 * @param session - Session validée (ou absente).
 * @param myUid - Uid de l'utilisateur courant (exclu).
 * @param now - Horloge courante (epoch ms).
 * @returns Clé de page vers les participants qui y sont.
 */
export function othersByPage(session: CookTogetherSession | null, myUid: string, now: number): Map<string, CookParticipant[]> {
  const out = new Map<string, CookParticipant[]>();
  if (!session) return out;
  for (const p of activeParticipants(session, now)) {
    if (p.uid === myUid) continue;
    out.set(p.page, [...(out.get(p.page) ?? []), p]);
  }
  return out;
}

/**
 * Sessions que l'utilisateur peut rejoindre : vivantes, avec au moins un autre membre
 * présent, et où lui-même n'est pas déjà actif. Les plus récentes d'abord.
 *
 * @param sessions - Sessions du foyer.
 * @param myUid - Uid de l'utilisateur courant.
 * @param now - Horloge courante (epoch ms).
 * @returns Les sessions à proposer dans le bandeau « Rejoindre ».
 */
export function joinableSessions(sessions: readonly CookTogetherSession[], myUid: string, now: number): CookTogetherSession[] {
  return sessions
    .filter((s) => {
      if (s.finished) return false;
      const active = activeParticipants(s, now);
      return active.some((p) => p.uid !== myUid) && !active.some((p) => p.uid === myUid);
    })
    .sort((a, b) => b.startedAt - a.startedAt);
}

/**
 * Prénom affichable d'un participant (premier mot du nom), pour les libellés courts.
 *
 * @param participant - Participant de la session.
 * @returns Le prénom, ou « Ton binôme » à défaut de nom.
 */
export function firstNameOf(participant: Pick<CookParticipant, "name">): string {
  return participant.name.trim().split(/\s+/)[0] || "Ton binôme";
}

/** Position d'un autre membre dans la suite des pages du pas à pas. */
export interface PartnerPosition {
  participant: CookParticipant;
  /** Index de sa page dans la suite des pages (0 = première). */
  index: number;
}

/**
 * Situe les autres membres dans la suite des pages (marqueur sur la barre de
 * progression, libellé « Léa : étape 4 »). Un membre sur une page inconnue de cet
 * appareil (recette modifiée entre-temps) est ignoré plutôt que mal placé.
 *
 * @param pageKeys - Clés des pages, dans l'ordre du pas à pas.
 * @param others - Autres membres par clé de page (cf. {@link othersByPage}).
 * @returns Les positions, dans l'ordre des pages.
 */
export function partnerPositions(pageKeys: readonly string[], others: ReadonlyMap<string, CookParticipant[]>): PartnerPosition[] {
  return pageKeys.flatMap((key, index) => (others.get(key) ?? []).map((participant) => ({ participant, index })));
}

/**
 * Libellé court d'une page du pas à pas (sommaire, position de l'autre membre).
 *
 * @param page - Page du pas à pas.
 * @returns « Mise en place », « Bases » ou « Étape N » (numérotée à partir de 1).
 */
export function cookPageLabel(page: CookPageRef): string {
  return page.kind === "overview" ? "Mise en place" : page.kind === "bases" ? "Bases" : `Étape ${page.realIdx + 1}`;
}
