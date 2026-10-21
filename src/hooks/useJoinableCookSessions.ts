import { useEffect, useMemo, useState } from "react";
import {
  HEARTBEAT_MS, activeParticipants, joinableSessions, parseCookSession,
  type CookParticipant, type CookTogetherSession,
} from "@/lib/cookSession/together.js";
import { subscribeCookSessions } from "@/lib/firebase/cookSessions.js";

/** Session à rejoindre et l'autre membre qui y cuisine. */
export interface JoinableCook {
  session: CookTogetherSession;
  cook: CookParticipant;
}

/**
 * Sessions de cuisine du foyer que l'utilisateur peut rejoindre (l'autre membre y est
 * présent, lui non). L'horloge est rafraîchie au rythme du battement de présence pour
 * que le bandeau disparaisse quand l'autre membre quitte sans fermer proprement.
 *
 * @param householdId - Foyer actif ; null en solo (aucun abonnement).
 * @param uid - Utilisateur courant.
 * @returns Les sessions à proposer avec le membre qui y cuisine, les plus récentes d'abord.
 */
export function useJoinableCookSessions(householdId: string | null, uid: string | undefined): JoinableCook[] {
  const [raws, setRaws] = useState<unknown[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!householdId || !uid) return;
    const unsub = subscribeCookSessions(householdId, (docs) => { setNow(Date.now()); setRaws(docs); });
    const tick = setInterval(() => setNow(Date.now()), HEARTBEAT_MS);
    return () => { unsub(); clearInterval(tick); setRaws([]); };
  }, [householdId, uid]);

  return useMemo(() => {
    if (!householdId || !uid) return [];
    const sessions = raws.map(parseCookSession).filter((s): s is CookTogetherSession => s !== null);
    return joinableSessions(sessions, uid, now).flatMap((session) => {
      const cook = activeParticipants(session, now).find((p) => p.uid !== uid);
      return cook ? [{ session, cook }] : [];
    });
  }, [householdId, raws, uid, now]);
}
