/**
 * Lecture de la config d'admission distante (`config/app`), pilotable depuis la
 * console Firebase sans redéploiement. Elle porte la version minimale autorisée
 * et l'allowlist d'hôtes canoniques ; la validation vit dans `src/lib/appGuard`.
 *
 * @module firebase/appConfig
 */
import { doc, getDoc, getDocFromCache, type DocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import { parseAppConfig, type AppConfig } from "@/lib/appGuard.js";
import { preferWithin, type PreferResult } from "@/lib/sync/preferWithin.js";

const configRef = () => doc(db, "config", "app");
const fromSnap = (snap: DocumentSnapshot): AppConfig | null => (snap.exists() ? parseAppConfig(snap.data()) : null);

/**
 * Charge et valide `config/app`. Fail-open : toute absence de doc ou erreur de
 * lecture retourne `null`, ce que le garde-fou interprète comme « aucune contrainte »
 * (on n'entrave jamais un utilisateur légitime sur un aléa réseau).
 */
export async function loadAppConfig(): Promise<AppConfig | null> {
  try {
    return fromSnap(await getDoc(configRef()));
  } catch {
    return null;
  }
}

/**
 * Config d'admission pour le démarrage : le serveur s'il répond dans `budgetMs`,
 * sinon la dernière version en cache local, sinon aucune contrainte (fail-open,
 * comme {@link loadAppConfig}). Ne fait jamais attendre l'écran de chargement au-delà
 * du budget ; l'appelant réévalue le garde-fou quand le serveur répond.
 *
 * @param server - Lecture serveur déjà lancée ({@link loadAppConfig}).
 * @param budgetMs - Temps accordé au serveur (0 = cache tout de suite).
 * @returns La config retenue (`null` = aucune contrainte) et sa provenance.
 */
export async function loadAppConfigFast(server: Promise<AppConfig | null>, budgetMs: number): Promise<PreferResult<AppConfig | null>> {
  const boxed = await preferWithin(
    server.then(config => ({ config })),
    async () => {
      try { return { config: fromSnap(await getDocFromCache(configRef())) }; } catch { return { config: null }; }
    },
    budgetMs,
  );
  return { value: boxed.value.config, source: boxed.source };
}
