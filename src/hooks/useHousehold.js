import { useEffect, useState, useCallback, useRef } from "react";
import { onSnapshot } from "firebase/firestore";
import { useAppShell } from "../context/AppShellContext.jsx";
import {
  householdMemberQuery, householdInviteQuery,
  createHousehold, inviteToHousehold, acceptInvite, declineInvite,
  leaveHousehold, dissolveHousehold, clearHouseholdPointer,
} from "../lib/firestore.js";

// ─── HOOK FOYER ───────────────────────────────────────────────────────────────
// Abonnements temps réel : mon foyer actif (membre par uid) + mes invitations en
// attente (par email). Expose des actions online-only (la membership exige le
// serveur : transactions + plafond). Phase 1 : gère l'appartenance, sans encore
// déplacer les données (le basculement de namespace arrive en Phase 2).
// Cache module (par uid) du dernier état connu du foyer. La carte foyer de
// l'Accueil se remonte à chaque navigation ; sans ce cache, `loading` repart à
// `true` et un skeleton grisé clignote le temps du 1er snapshot Firestore. On
// réhydrate donc immédiatement l'état connu et le snapshot ne fait que rafraîchir.
let hhCache = { uid: null, household: null, invites: [] };

export function useHousehold() {
  const { user, notify, getSharedData } = useAppShell();
  const cached = hhCache.uid && hhCache.uid === user?.uid;
  const [household, setHousehold] = useState(cached ? hhCache.household : null);
  const [invites, setInvites] = useState(cached ? hhCache.invites : []);
  const [loading, setLoading] = useState(!cached);
  const hadHousehold = useRef(!!(cached && hhCache.household));

  useEffect(() => {
    if (!user?.uid) { hhCache = { uid: null, household: null, invites: [] }; setHousehold(null); setInvites([]); setLoading(false); return; }
    // Changement de compte : on repart d'un état vierge (pas de fuite entre uids).
    if (hhCache.uid !== user.uid) { hhCache = { uid: user.uid, household: null, invites: [] }; setLoading(true); }
    const unsubMember = onSnapshot(householdMemberQuery(user.uid), snap => {
      const h = snap.docs[0]?.data() || null;
      hhCache = { ...hhCache, uid: user.uid, household: h };
      setHousehold(h);
      setLoading(false);
      // Foyer dissous par autrui pendant que j'en étais membre → nettoie mon pointeur.
      if (hadHousehold.current && !h) clearHouseholdPointer(user.uid);
      hadHousehold.current = !!h;
    }, () => setLoading(false));
    let unsubInvite = () => {};
    if (user.email) {
      unsubInvite = onSnapshot(householdInviteQuery(user.email),
        snap => { const arr = snap.docs.map(d => d.data()); hhCache = { ...hhCache, uid: user.uid, invites: arr }; setInvites(arr); }, () => {});
    }
    return () => { unsubMember(); unsubInvite(); };
  }, [user]);

  // Garde online : les opérations d'appartenance ne doivent pas partir en file
  // offline (plafond + transactions serveur).
  const online = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      notify("Action indisponible hors ligne", "error");
      return false;
    }
    return true;
  }, [notify]);

  const run = useCallback(async (fn, errMsg) => {
    if (!online()) return false;
    try { await fn(); return true; }
    catch (e) { notify(e?.message ? `${errMsg} : ${e.message}` : errMsg, "error"); return false; }
  }, [online, notify]);

  const actions = {
    create: (name) => run(() => createHousehold(user, name, getSharedData?.()), "Création du foyer échouée"),
    invite: (email) => run(() => inviteToHousehold(household.id, email), "Invitation échouée"),
    accept: (hid) => run(() => acceptInvite(hid, user), "Adhésion échouée"),
    decline: (hid) => run(() => declineInvite(hid, user.email), "Refus échoué"),
    cancelInvite: (email) => run(() => declineInvite(household.id, email), "Annulation échouée"),
    leave: () => run(() => leaveHousehold(household.id, user), "Départ échoué"),
    dissolve: () => run(() => dissolveHousehold(household.id, user.uid), "Dissolution échouée"),
  };

  return { household, invites, loading, actions };
}
