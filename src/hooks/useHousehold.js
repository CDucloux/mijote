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
export function useHousehold() {
  const { user, notify } = useAppShell();
  const [household, setHousehold] = useState(null);   // foyer actif ou null
  const [invites, setInvites] = useState([]);          // foyers où je suis invité
  const [loading, setLoading] = useState(true);
  const hadHousehold = useRef(false);

  useEffect(() => {
    if (!user?.uid) { setHousehold(null); setInvites([]); setLoading(false); return; }
    // (pas de setState synchrone ici : l'état de chargement est résolu par le 1er
    //  snapshot ci-dessous, ce qui évite un rendu en cascade.)
    const unsubMember = onSnapshot(householdMemberQuery(user.uid), snap => {
      const h = snap.docs[0]?.data() || null;
      setHousehold(h);
      setLoading(false);
      // Foyer dissous par autrui pendant que j'en étais membre → nettoie mon pointeur.
      if (hadHousehold.current && !h) clearHouseholdPointer(user.uid);
      hadHousehold.current = !!h;
    }, () => setLoading(false));
    let unsubInvite = () => {};
    if (user.email) {
      unsubInvite = onSnapshot(householdInviteQuery(user.email),
        snap => setInvites(snap.docs.map(d => d.data())), () => {});
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
    create: (name) => run(() => createHousehold(user, name), "Création du foyer échouée"),
    invite: (email) => run(() => inviteToHousehold(household.id, email), "Invitation échouée"),
    accept: (hid) => run(() => acceptInvite(hid, user), "Adhésion échouée"),
    decline: (hid) => run(() => declineInvite(hid, user.email), "Refus échoué"),
    cancelInvite: (email) => run(() => declineInvite(household.id, email), "Annulation échouée"),
    leave: () => run(() => leaveHousehold(household.id, user), "Départ échoué"),
    dissolve: () => run(() => dissolveHousehold(household.id, user.uid), "Dissolution échouée"),
  };

  return { household, invites, loading, actions };
}
