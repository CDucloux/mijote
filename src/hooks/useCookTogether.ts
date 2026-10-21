import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useOnline } from "./useOnline.js";
import {
  HEARTBEAT_MS, othersByPage, parseCookSession,
  type CookParticipant, type CookTogetherSession,
} from "@/lib/cookSession/together.js";
import {
  joinCookSession, publishPresence, markStepDone, finishCookSession, leaveCookSession, subscribeCookSession,
  type CookMember,
} from "@/lib/firebase/cookSessions.js";

interface UseCookTogetherArgs {
  /** Foyer actif ; null en solo (le hook ne fait alors rien). */
  householdId: string | null;
  /** Recette cuisinée (id + nom pour le bandeau de l'autre membre). */
  recipe: { id?: string; name?: string };
  /** Utilisateur connecté (identité publiée) ; null tant qu'il n'est pas connu. */
  user: { uid: string; displayName: string | null; email: string | null; photoURL: string | null } | null;
  /** Clé de la page courante (cf. `pageKeyOf`). */
  pageKey: string;
  /** Faux pour un pas à pas imbriqué (préparation de base) : jamais partagé. */
  enabled: boolean;
}

export interface CookTogether {
  /** Session partagée validée (null en solo ou avant la première lecture). */
  session: CookTogetherSession | null;
  /** Autres membres présents, par clé de page. */
  others: Map<string, CookParticipant[]>;
  /** Index réels des étapes faites par l'un ou l'autre. */
  doneSteps: ReadonlySet<number>;
  /** Lancement commun (epoch ms) une fois la session rejointe, sinon null. */
  startedAt: number | null;
  /** Recette terminée par l'un des membres, dans la session effectivement rejointe. */
  finished: boolean;
  /** Uid de celui qui a terminé (lui seul consigne le plat), null sinon. */
  finishedBy: string | null;
  /** En foyer mais hors ligne : l'autre membre ne voit plus où on en est. */
  offline: boolean;
  markDone: (realIdx: number) => void;
  finish: () => void;
}

const ignore = () => {};

/**
 * Cuisiner à deux : rejoint la session de la recette dans le foyer, publie sa page et
 * sa présence (battement régulier), suit celle de l'autre membre et les étapes faites,
 * et quitte la session à la fermeture du pas à pas. Sans foyer, tout est inerte.
 */
export function useCookTogether({ householdId, recipe, user, pageKey, enabled }: UseCookTogetherArgs): CookTogether {
  const me = useMemo<CookMember | null>(
    () => (user ? { uid: user.uid, name: user.displayName || user.email || "", photoURL: user.photoURL || "" } : null),
    [user],
  );
  const hid = enabled && me && recipe.id ? householdId : null;
  const rid = recipe.id ?? "";
  const uid = me?.uid ?? "";
  const [raw, setRaw] = useState<unknown>(undefined);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Dernières valeurs lues par le battement et le départ, sans relancer l'abonnement.
  const pageRef = useRef(pageKey);
  const meRef = useRef(me);
  const nameRef = useRef(recipe.name ?? "");
  useEffect(() => {
    pageRef.current = pageKey;
    meRef.current = me;
    nameRef.current = recipe.name ?? "";
  });

  // Rejoindre (et retenter tant que ce n'est pas fait : la transaction exige le réseau),
  // s'abonner, battre la présence ; passer « en veille » quand l'app quitte l'écran
  // (le système suspend alors le battement) ; quitter au démontage ou à la fermeture
  // de l'onglet (pagehide), pour ne pas laisser un fantôme dans le bandeau de l'autre.
  useEffect(() => {
    const self = meRef.current;
    if (!hid || !self) return;
    let alive = true;
    let joined = false;
    let joining = false;
    const away = () => typeof document !== "undefined" && document.visibilityState === "hidden";
    const tryJoin = () => {
      if (joined || joining) return;
      joining = true;
      joinCookSession(hid, { id: rid, name: nameRef.current }, self, pageRef.current)
        .then((t) => { joined = true; if (alive) setStartedAt(t); })
        .catch(ignore)
        .finally(() => { joining = false; });
    };
    const beat = () => {
      setNow(Date.now());
      if (!joined) tryJoin();
      else publishPresence(hid, rid, self, pageRef.current, away()).catch(ignore);
    };
    tryJoin();
    const unsub = subscribeCookSession(hid, rid, (data) => { setNow(Date.now()); setRaw(data); });
    const timer = setInterval(beat, HEARTBEAT_MS);
    const leave = () => { leaveCookSession(hid, rid, self.uid).catch(ignore); };
    window.addEventListener("online", tryJoin);
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("pagehide", leave);
    return () => {
      alive = false;
      unsub();
      clearInterval(timer);
      window.removeEventListener("online", tryJoin);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("pagehide", leave);
      leave();
      setRaw(undefined);
      setStartedAt(null);
    };
  }, [hid, rid]);

  useEffect(() => {
    if (!hid || !me || startedAt === null) return;
    // « Suivant » depuis la notification Android change la page app en arrière-plan.
    publishPresence(hid, rid, me, pageKey, document.visibilityState === "hidden").catch(ignore);
  }, [hid, rid, me, pageKey, startedAt]);

  const session = useMemo(() => (hid ? parseCookSession(raw) : null), [hid, raw]);
  const others = useMemo(() => othersByPage(session, uid, now), [session, uid, now]);
  const doneSteps = useMemo(() => new Set(session?.doneSteps ?? []), [session]);
  const markDone = useCallback((realIdx: number) => {
    if (hid && realIdx >= 0) markStepDone(hid, rid, realIdx).catch(ignore);
  }, [hid, rid]);
  const finish = useCallback(() => {
    if (hid && uid) finishCookSession(hid, rid, uid).catch(ignore);
  }, [hid, rid, uid]);

  // Une session terminée n'est prise en compte qu'une fois rejointe : à la relance
  // d'une recette, l'ancienne session « terminée » peut arriver avant sa remise à zéro.
  const finished = !!session?.finished && startedAt !== null && session.startedAt === startedAt;

  const online = useOnline();

  return {
    session, others, doneSteps, startedAt, finished, finishedBy: finished ? session?.finishedBy ?? null : null,
    offline: hid !== null && !online, markDone, finish,
  };
}
