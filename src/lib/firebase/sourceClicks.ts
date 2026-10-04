/**
 * Comptage des clics sortants vers les sources d'origine (créatrices, blogs).
 *
 * `sourceClicks/{domaine}__{YYYY-MM}` : un compteur par domaine et par mois,
 * incrémenté de 1 par clic (seul incrément autorisé par firestore.rules), lu par
 * l'admin pour présenter aux créatrices le trafic que Cardamome leur renvoie.
 *
 * @module firebase/sourceClicks
 */
import { doc, setDoc, getDocs, collection, query, where, increment } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/firebase.js";
import { sourceClickKey, sourceHost, clickMonth } from "@/lib/sources/outboundLink.js";

/** Compteur de clics d'un domaine sur un mois. */
export interface SourceClickCount {
  host: string;
  month: string;
  count: number;
}

/**
 * Compte un clic sortant vers une source. Silencieux et non bloquant : le lien
 * s'ouvre quoi qu'il arrive ; sans session (visiteur d'une recette publique) ou
 * pour une source non web, rien n'est écrit.
 *
 * @param source - La source cliquée (URL de recette ou de créatrice).
 * @param now - L'instant du clic (injectable pour les tests).
 * @returns La promesse d'écriture (erreurs avalées).
 */
export async function recordSourceClick(source: string | null | undefined, now: Date = new Date()): Promise<void> {
  const key = sourceClickKey(source, now);
  if (!key || !auth.currentUser) return;
  await setDoc(
    doc(db, "sourceClicks", key),
    { host: sourceHost(source), month: clickMonth(now), count: increment(1) },
    { merge: true },
  ).catch(() => {});
}

/**
 * Compteurs de clics d'un mois, tous domaines confondus (admin uniquement).
 *
 * @param month - Le mois au format `YYYY-MM`.
 * @returns Les compteurs du mois (données externes narrowées).
 */
export async function fetchSourceClicks(month: string): Promise<SourceClickCount[]> {
  const snap = await getDocs(query(collection(db, "sourceClicks"), where("month", "==", month)));
  return snap.docs.flatMap((d) => {
    const data: unknown = d.data();
    if (!data || typeof data !== "object") return [];
    const { host, count } = data as Record<string, unknown>;
    if (typeof host !== "string" || typeof count !== "number") return [];
    return [{ host, month, count }];
  });
}
