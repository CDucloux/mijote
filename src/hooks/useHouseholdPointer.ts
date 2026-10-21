import { useEffect, useState } from "react";
import { subscribeHouseholdPointer } from "@/lib/firebase/households.js";
import { readCachedHid } from "./useFirestoreSync.js";

/** Foyer actif de l'utilisateur, tel que pointé par `users/{uid}/meta/household`. */
export interface HouseholdPointer {
  id: string;
  migrated: boolean;
}

const pointerOf = (data: Record<string, unknown> | null): HouseholdPointer | null =>
  data && typeof data.id === "string" && data.id ? { id: data.id, migrated: data.migrated === true } : null;

/**
 * Pointeur du foyer actif (null en solo), suivi en temps réel. Amorcé de façon
 * optimiste depuis le cache local : hors ligne, l'écoute peut tarder à confirmer, et
 * sans cette amorce l'app basculerait le temps d'un instant sur l'espace solo.
 *
 * @param uid - Utilisateur connecté, ou null.
 */
export function useHouseholdPointer(uid: string | null): HouseholdPointer | null {
  const [pointer, setPointer] = useState<HouseholdPointer | null>(null);
  useEffect(() => {
    if (!uid) { setPointer(null); return; }
    const cachedHid = readCachedHid(uid);
    if (cachedHid) setPointer(prev => prev || { id: cachedHid, migrated: true });
    return subscribeHouseholdPointer(uid, data => setPointer(pointerOf(data)));
  }, [uid]);
  return pointer;
}
