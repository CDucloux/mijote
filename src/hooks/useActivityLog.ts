import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { User } from "firebase/auth";
import { appendActivity, subscribeActivity } from "@/lib/firebase/firestore.js";
import { soloWorkspace, householdWorkspace, type Workspace } from "@/lib/household/workspace.js";
import { parseActivity, type ActivityEvent, type ActivityInput } from "@/lib/notifications/activity.js";

/** Dépendances : identité, foyer actif, disponibilité du workspace, nom affiché. */
export interface ActivityLogDeps {
  user: User | null;
  /** Identifiant du foyer actif (null en solo). */
  householdId: string | null;
  /** Vrai quand le namespace chargé correspond au namespace voulu (cf. useFirestoreSync). */
  workspaceReady: boolean;
  /** Nom affiché courant, mémorisé sur chaque évènement pour l'autre membre. */
  actorName?: string;
}

/**
 * Journal d'activité du tableau de bord : s'abonne aux derniers évènements du
 * workspace actif (solo ou foyer) et expose `logActivity` pour en ajouter, à
 * co-localiser avec les toasts `notify` des actions métier. Le workspace cible est
 * dérivé du foyer actif ; l'écriture n'a lieu que lorsque le workspace est prêt
 * (évite d'écrire dans un namespace en cours de bascule).
 *
 * @param deps - Identité, foyer actif, disponibilité du workspace, nom affiché.
 * @returns `{ activities, logActivity }`.
 */
export function useActivityLog({ user, householdId, workspaceReady, actorName }: ActivityLogDeps): {
  activities: ActivityEvent[];
  logActivity: (input: ActivityInput) => void;
} {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const ws = useMemo<Workspace | null>(
    () => (user ? (householdId ? householdWorkspace(householdId) : soloWorkspace(user.uid)) : null),
    [user, householdId]
  );

  useEffect(() => {
    if (!user || !ws || !workspaceReady) { setActivities([]); return; }
    const unsub = subscribeActivity(ws, docs => {
      const now = Date.now();
      setActivities(docs.map(d => parseActivity(d.id, d.data, now)).filter((e): e is ActivityEvent => e !== null));
    });
    return () => unsub();
  }, [user, ws, workspaceReady]);

  // Refs « dernière valeur » : `logActivity` garde une identité stable (utile pour le
  // contexte App Shell) tout en lisant toujours le nom et l'état de préparation à jour.
  const nameRef = useRef(actorName || "");
  nameRef.current = actorName || "";
  const readyRef = useRef(workspaceReady);
  readyRef.current = workspaceReady;

  const logActivity = useCallback((input: ActivityInput) => {
    if (!user || !ws || !readyRef.current) return;
    void appendActivity(ws, {
      type: input.type,
      target: input.target || "",
      // Firestore refuse les champs `undefined` : on n'ajoute targetId que s'il existe.
      ...(input.targetId ? { targetId: input.targetId } : {}),
      count: input.count || 0,
      actorEmail: (user.email || "").toLowerCase(),
      actorName: nameRef.current,
    }).catch(() => { /* notification manquée : ne jamais casser l'action métier */ });
  }, [user, ws]);

  return { activities, logActivity };
}
