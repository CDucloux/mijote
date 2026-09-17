import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { creditState, canImport, type ImportKind, type CreditState, type UsageDoc } from "@/lib/aiQuota.js";

// ─── Suivi TEMPS RÉEL des crédits d'import IA (aiUsage/{uid}) ─────────────────
// Le document est écrit par le serveur (Cloud Function, en transaction) et lisible
// par l'utilisateur. On l'écoute pour afficher un reliquat de crédits qui se met à
// jour tout seul après chaque import. L'admin est illimité : on court-circuite
// l'écoute.

export interface AiUsage {
  usage: UsageDoc | null;
  unlimited: boolean;
  credits: CreditState;
  canImport: (kind: ImportKind) => boolean;
}

/**
 * @param uid - Identifiant utilisateur (null/undefined → pas d'écoute).
 * @param isAdmin - Admin → illimité, aucune écoute.
 */
export function useAiUsage(uid: string | null | undefined, isAdmin: boolean): AiUsage {
  const [usage, setUsage] = useState<UsageDoc | null>(null);

  useEffect(() => {
    if (!uid || isAdmin) { setUsage(null); return; }
    const ref = doc(db, "aiUsage", uid);
    const unsub = onSnapshot(ref, (snap) => setUsage(snap.exists() ? (snap.data() as UsageDoc) : {}), () => setUsage({}));
    return unsub;
  }, [uid, isAdmin]);

  const credits = creditState(usage);
  return {
    usage,
    unlimited: !!isAdmin,
    credits,
    canImport: (kind: ImportKind) => canImport(credits, kind),
  };
}
