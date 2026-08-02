/**
 * Foyer (logique pure, sans Firebase). Un foyer regroupe jusqu'à `MAX_HOUSEHOLD`
 * personnes qui partagent recettes, stock, listes et planning. Document :
 * `households/{hid}` `{ ownerUid, name, memberUids[], memberEmails[], invitedEmails[], createdAt }`.
 * L'appartenance fait foi par `uid` (sécurité) ; les invitations se font par email
 * (on ne connaît pas l'uid de l'invité à l'avance). Le plafond compte les membres
 * ACTIFS + les invitations EN ATTENTE : on ne peut pas inviter au-delà des places.
 *
 * @module household
 */

/** Document de foyer. */
export interface Household {
  id?: string;
  name?: string;
  ownerUid?: string;
  memberUids?: string[];
  memberEmails?: string[];
  invitedEmails?: string[];
  createdAt?: number;
}

/** Utilisateur (forme minimale) : uid + email. */
export interface HouseholdUser {
  uid: string;
  email?: string;
}

export const MAX_HOUSEHOLD = 2;

const norm = (e: string | undefined): string => (e || "").trim().toLowerCase();
const uniq = <T,>(arr: T[]): T[] => Array.from(new Set(arr));

/** Nombre de « places occupées » : membres actifs + invitations en attente. */
export function peopleCount(h: Household | null | undefined): number {
  return (h?.memberUids?.length || 0) + (h?.invitedEmails?.length || 0);
}

export function isOwner(h: Household | null | undefined, uid: string): boolean {
  return !!h && h.ownerUid === uid;
}

export function isMemberUid(h: Household | null | undefined, uid: string): boolean {
  return !!h && (h.memberUids || []).includes(uid);
}

/** Document initial d'un foyer créé par `owner` (qui en est le 1er membre). */
export function newHouseholdDoc({ id, owner, name }: { id?: string; owner: HouseholdUser; name?: string }): Required<Pick<Household, "name" | "ownerUid" | "memberUids" | "memberEmails" | "invitedEmails" | "createdAt">> & { id?: string } {
  const email = norm(owner.email);
  return {
    id,
    name: (name || "").trim() || "Mon foyer",
    ownerUid: owner.uid,
    memberUids: [owner.uid],
    memberEmails: email ? [email] : [],
    invitedEmails: [],
    createdAt: Date.now(),
  };
}

/** Peut-on inviter `email` ? Non si plein, si déjà membre, ou déjà invité. */
export function canInvite(h: Household, email: string): boolean {
  const e = norm(email);
  if (!e) return false;
  if (peopleCount(h) >= MAX_HOUSEHOLD) return false;
  if ((h.memberEmails || []).includes(e)) return false;
  if ((h.invitedEmails || []).includes(e)) return false;
  return true;
}

/** Ajoute une invitation (pure). Renvoie le doc inchangé si non invitable. */
export function withInvite(h: Household, email: string): Household {
  const e = norm(email);
  if (!canInvite(h, e)) return h;
  return { ...h, invitedEmails: uniq([...(h.invitedEmails || []), e]) };
}

/** Retire une invitation en attente (refus, ou retrait par un membre). */
export function withInviteRemoved(h: Household, email: string): Household {
  const e = norm(email);
  return { ...h, invitedEmails: (h.invitedEmails || []).filter(x => x !== e) };
}

/**
 * Transforme une invitation en membre actif. Idempotent ; respecte le plafond
 * (un invité présent dans invitedEmails ne consomme pas de place supplémentaire).
 */
export function withAcceptedMember(h: Household, { uid, email }: { uid: string; email?: string }): Household {
  const e = norm(email);
  if (isMemberUid(h, uid)) return h;
  if ((h.memberUids || []).length >= MAX_HOUSEHOLD) return h;
  return {
    ...h,
    memberUids: uniq([...(h.memberUids || []), uid]),
    memberEmails: e ? uniq([...(h.memberEmails || []), e]) : (h.memberEmails || []),
    invitedEmails: (h.invitedEmails || []).filter(x => x !== e),
  };
}

/**
 * Retire un membre (départ volontaire ou retrait). N'altère pas le propriétaire ici
 * (la dissolution se fait par suppression du document, pas par retrait du owner).
 */
export function withMemberRemoved(h: Household, { uid, email }: { uid: string; email?: string }): Household {
  const e = norm(email);
  return {
    ...h,
    memberUids: (h.memberUids || []).filter(x => x !== uid),
    memberEmails: (h.memberEmails || []).filter(x => x !== e),
  };
}
