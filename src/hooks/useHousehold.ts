import { useEffect, useState, useCallback, useRef } from "react";
import { onSnapshot, type DocumentData, type Unsubscribe } from "firebase/firestore";
import { useAppShell } from "../context/AppShellContext.jsx";
import {
  householdMemberQuery, householdInviteQuery,
  createHousehold, inviteToHousehold, acceptInvite, declineInvite,
  exitAllHouseholds, clearHouseholdPointer, setHouseholdPointer,
  subscribeHouseholdPointer,
} from "@/lib/firebase/households.js";
import { reconcileHouseholdPointer, type PointerState } from "@/lib/household/pointerSync.js";

// ─── HOOK FOYER ───────────────────────────────────────────────────────────────
// Abonnements temps réel : mon foyer actif (membre par uid) + mes invitations en
// attente (par email). Expose des actions online-only (la membership exige le
// serveur : transactions + plafond). Phase 1 : gère l'appartenance, sans encore
// déplacer les données (le basculement de namespace arrive en Phase 2).
// Cache module (par uid) du dernier état connu du foyer. La carte foyer de
// l'Accueil se remonte à chaque navigation ; sans ce cache, `loading` repart à
// `true` et un skeleton grisé clignote le temps du 1er snapshot Firestore. On
// réhydrate donc immédiatement l'état connu et le snapshot ne fait que rafraîchir.
let hhCache: { uid: string | null; household: DocumentData | null; invites: DocumentData[] } = { uid: null, household: null, invites: [] };

/**
 * Appartenance à un foyer (abonnements temps réel + actions serveur). Expose mon
 * foyer actif, mes invitations en attente et un jeu d'actions online-only
 * (création, invitation, adhésion, départ, dissolution…).
 *
 * @returns `{ household, invites, loading, actions }`.
 */
/** Sous-ensemble du contexte applicatif consommé par ce hook. */
interface AppShellSlice {
  user: { uid: string; email?: string } | null | undefined;
  notify: (msg: string, type?: string) => void;
  getSharedData?: () => unknown;
}

export function useHousehold() {
  const { user, notify, getSharedData } = useAppShell() as AppShellSlice;
  const cached = hhCache.uid && hhCache.uid === user?.uid;
  const [household, setHousehold] = useState<DocumentData | null>(cached ? hhCache.household : null);
  const [invites, setInvites] = useState<DocumentData[]>(cached ? hhCache.invites : []);
  const [loading, setLoading] = useState(!cached);
  const [creating, setCreating] = useState(false);
  // Verrou anti double-création : un clic répété (ou deux onglets) ne doit pas
  // semer plusieurs foyers fantômes. Le ref garde l'invariant même entre deux
  // rendus, avant que `creating` (asynchrone) ne se propage.
  const creatingRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) { hhCache = { uid: null, household: null, invites: [] }; setHousehold(null); setInvites([]); setLoading(false); return; }
    // Changement de compte : on repart d'un état vierge (pas de fuite entre uids).
    if (hhCache.uid !== user.uid) { hhCache = { uid: user.uid, household: null, invites: [] }; setLoading(true); }
    const uid = user.uid;
    // Réconciliation du pointeur de workspace avec l'APPARTENANCE autoritaire : sans
    // elle, un membre dont le pointeur est absent/périmé (ex. effacé par erreur sur un
    // snapshot transitoirement vide, ou adhésion dont le pointeur n'a jamais été posé)
    // reste coincé sur son espace solo et ne partage plus RIEN avec le foyer. On garde
    // en ref le dernier pointeur et la dernière appartenance connus, et on ne (ré)écrit
    // le pointeur qu'en cas de divergence réelle (jamais d'écrasement d'un `migrated:true`
    // sain, qui relancerait une fusion à chaque snapshot).
    let memberHid: string | null = null;
    let pointer: PointerState | null = null;
    // Tant que l'appartenance n'a pas livré son 1er snapshot, `memberHid === null`
    // signifie « inconnu », pas « aucun foyer » : réconcilier maintenant effacerait à
    // tort le pointeur (puis le reposerait, déclenchant une fusion parasite à chaque
    // chargement). On attend donc la confirmation de l'appartenance avant d'agir.
    let memberLoaded = false;
    const reconcile = (): void => {
      if (!memberLoaded) return;
      const action = reconcileHouseholdPointer(memberHid, pointer);
      if (action.kind === "set") setHouseholdPointer(uid, action.hid, action.migrated);
      else if (action.kind === "clear") clearHouseholdPointer(uid);
    };
    const unsubPointer = subscribeHouseholdPointer(uid, p => {
      pointer = p && typeof p.id === "string" ? { id: p.id, migrated: !!p.migrated } : null;
      reconcile();
    });
    const unsubMember = onSnapshot(householdMemberQuery(uid), snap => {
      // `.data()` ne porte JAMAIS l'id du document : on le rattache ici, sinon les
      // actions serveur (invitation, dissolution…) reçoivent `hid = undefined`.
      const d = snap.docs[0];
      const h = d ? { id: d.id, ...d.data() } : null;
      hhCache = { ...hhCache, uid, household: h };
      setHousehold(h);
      setLoading(false);
      memberHid = h ? h.id : null;
      memberLoaded = true;
      // Ramène le pointeur de workspace en phase avec l'appartenance (pose à l'adhésion,
      // efface sur foyer dissous par autrui, corrige un pointeur perdu/périmé).
      reconcile();
    }, () => setLoading(false));
    let unsubInvite: Unsubscribe = () => {};
    if (user.email) {
      unsubInvite = onSnapshot(householdInviteQuery(user.email),
        // `.data()` ne porte pas l'id : on le rattache, sinon `actions.accept(inv.id)`
        // reçoit `hid = undefined` et l'adhésion échoue au premier accès Firestore.
        snap => { const arr = snap.docs.map(d => ({ id: d.id, ...d.data() })); hhCache = { ...hhCache, uid: user.uid, invites: arr }; setInvites(arr); }, () => {});
    }
    return () => { unsubPointer(); unsubMember(); unsubInvite(); };
  }, [user]);

  // Garde online : les opérations d'appartenance ne doivent pas partir en file
  // offline (plafond + transactions serveur).
  const online = useCallback((): boolean => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      notify("Action indisponible hors ligne", "error");
      return false;
    }
    return true;
  }, [notify]);

  const run = useCallback(async (fn: () => Promise<unknown>, errMsg: string): Promise<boolean> => {
    if (!online()) return false;
    try { await fn(); return true; }
    catch (e) { const msg = (e as { message?: string })?.message; notify(msg ? `${errMsg} : ${msg}` : errMsg, "error"); return false; }
  }, [online, notify]);

  // Création idempotente : refuse un second appel tant qu'un est en vol, et ne
  // crée pas un foyer si on en a déjà un (les clics rapides ne sèment qu'un foyer).
  const create = useCallback(async (name: string): Promise<boolean> => {
    if (creatingRef.current || household) return false;
    creatingRef.current = true;
    setCreating(true);
    try {
      return await run(() => createHousehold(user!, name, getSharedData?.() as Parameters<typeof createHousehold>[2]), "Création du foyer échouée");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }, [household, run, user, getSharedData]);

  const actions = {
    create,
    invite: (email: string) => run(() => inviteToHousehold(household?.id, email), "Invitation échouée"),
    accept: (hid: string) => run(() => acceptInvite(hid, user!), "Adhésion échouée"),
    decline: (hid: string) => run(() => declineInvite(hid, user!.email!), "Refus échoué"),
    cancelInvite: (email: string) => run(() => declineInvite(household?.id, email), "Annulation échouée"),
    // Départ et dissolution sortent l'utilisateur de TOUS ses foyers (dont d'éventuels
    // doublons fantômes), pour ne plus jamais rester « coincé » dans un foyer résiduel.
    leave: () => run(() => exitAllHouseholds(user!), "Départ échoué"),
    dissolve: () => run(() => exitAllHouseholds(user!), "Dissolution échouée"),
  };

  return { household, invites, loading, creating, actions };
}
