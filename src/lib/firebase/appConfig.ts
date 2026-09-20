/**
 * Lecture de la config d'admission distante (`config/app`), pilotable depuis la
 * console Firebase sans redéploiement. Elle porte la version minimale autorisée
 * et l'allowlist d'hôtes canoniques ; la validation vit dans `src/lib/appGuard`.
 *
 * @module firebase/appConfig
 */
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { parseAppConfig, type AppConfig } from "@/lib/appGuard.js";

/**
 * Charge et valide `config/app`. Fail-open : toute absence de doc ou erreur de
 * lecture retourne `null`, ce que le garde-fou interprète comme « aucune contrainte »
 * (on n'entrave jamais un utilisateur légitime sur un aléa réseau).
 */
export async function loadAppConfig(): Promise<AppConfig | null> {
  try {
    const snap = await getDoc(doc(db, "config", "app"));
    return snap.exists() ? parseAppConfig(snap.data()) : null;
  } catch {
    return null;
  }
}
