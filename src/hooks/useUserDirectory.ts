import { useCallback, useRef, useState } from "react";
import { fetchUserDirectory } from "@/lib/firebase/userDirectory.js";
import type { AppShell } from "../context/AppShellContext.jsx";

/** Annuaire chargé à la demande et son déclencheur. */
export interface UserDirectory {
  directory: AppShell["directory"];
  loadDirectory: () => Promise<void>;
}

/**
 * Annuaire des utilisateurs connus (avatars des membres du foyer, invitations),
 * chargé À LA DEMANDE : les utilisateurs solo ne le lisent jamais. Rechargé après un
 * changement de compte.
 *
 * @param uid - Utilisateur connecté, ou null.
 */
export function useUserDirectory(uid: string | null): UserDirectory {
  const [directory, setDirectory] = useState<AppShell["directory"]>([]);
  const loadedFor = useRef<string | null>(null);
  const loadDirectory = useCallback(async () => {
    if (!uid || loadedFor.current === uid) return;
    loadedFor.current = uid;
    try { setDirectory(await fetchUserDirectory()); }
    catch { loadedFor.current = null; }
  }, [uid]);
  return { directory, loadDirectory };
}
