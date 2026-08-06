import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { remainingFor } from "@/lib/aiQuota.js";

// ─── Suivi TEMPS RÉEL des compteurs d'import IA (aiUsage/{uid}) ───────────────
// Le document est écrit par le serveur (Cloud Function, en transaction) et lisible
// par l'utilisateur. On l'écoute pour afficher un reliquat qui se met à jour tout
// seul après chaque import. L'admin est illimité : on court-circuite l'écoute.

/**
 * @param {string|null|undefined} uid Identifiant utilisateur (null → pas d'écoute).
 * @param {boolean} isAdmin Admin → illimité, aucune écoute.
 * @returns {{ usage: object|null, unlimited: boolean, remaining: (kind: "url"|"photo") => object }}
 */
export function useAiUsage(uid, isAdmin) {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (!uid || isAdmin) { setUsage(null); return; }
    const ref = doc(db, "aiUsage", uid);
    const unsub = onSnapshot(ref, (snap) => setUsage(snap.exists() ? snap.data() : {}), () => setUsage({}));
    return unsub;
  }, [uid, isAdmin]);

  return {
    usage,
    unlimited: !!isAdmin,
    remaining: (kind) => remainingFor(usage, kind),
  };
}
