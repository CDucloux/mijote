/**
 * Recettes publiques (communauté) et signalements (modération).
 *
 * `publicRecipes/{pubId}` : collection top-level lisible par tous les connectés,
 * écrite uniquement par l'auteur (cf. firestore.rules). `reports/{id}` : signalements
 * d'une recette publique, créés par le rapporteur, traités par l'admin.
 *
 * @module firebase/community
 */
import {
  doc, getDoc, collection, getDocs, writeBatch, query, orderBy, limit, where,
  deleteDoc, addDoc, serverTimestamp,
  type DocumentData, type DocumentReference, type CollectionReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebase.js";
import type { PublicDoc } from "@/lib/household/publicRecipes.js";

/** Réf. de la collection des recettes publiques (top-level `publicRecipes`). */
export const publicRecipesCol = (): CollectionReference => collection(db, "publicRecipes");
/** Réf. d'une recette publique donnée (`publicRecipes/{pubId}`). */
export const publicRecipeDoc = (pubId: string): DocumentReference => doc(db, "publicRecipes", pubId);

/**
 * Supprime UNE recette publique (modération admin). Ne retire QUE le document
 * public `publicRecipes/{pubId}`, la copie privée de l'auteur n'est pas touchée
 * (elle est dans son espace, inaccessible depuis ici). Autorisé par les règles
 * pour l'auteur (dépublication) OU l'admin (modération).
 *
 * @param pubId - L'identifiant du document public.
 */
export async function deletePublicRecipe(pubId: string): Promise<void> {
  await deleteDoc(publicRecipeDoc(pubId));
}

/** Détails d'un signalement de recette publique (modération). */
export interface RecipeReport {
  pubId: string;
  recipeName?: string;
  authorUid?: string;
  reason: string;
  note?: string;
  reporterUid: string;
  reporterEmail?: string | null;
}

/**
 * Enregistre un signalement d'une recette publique (droit d'auteur, photo
 * inappropriée…) dans `reports/{autoId}`. Lisible uniquement par l'admin.
 *
 * @param report - Les détails du signalement.
 */
export async function reportPublicRecipe(report: RecipeReport): Promise<void> {
  await addDoc(collection(db, "reports"), { ...report, createdAt: serverTimestamp() });
}

/** Un signalement tel que lu par la modération (id du doc + horodatage résolu). */
export interface StoredReport extends RecipeReport {
  id: string;
  createdAtMs: number | null;
}

/**
 * Charge tous les signalements (modération admin), du plus récent au plus ancien.
 *
 * @returns La liste des signalements stockés.
 */
export async function loadReports(): Promise<StoredReport[]> {
  const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
  return snap.docs.map(d => {
    const data = d.data() as RecipeReport & { createdAt?: { toMillis?: () => number } };
    return { ...data, id: d.id, createdAtMs: data.createdAt?.toMillis?.() ?? null };
  });
}

/**
 * Rejette (supprime) un signalement précis.
 *
 * @param id - L'identifiant du document `reports`.
 */
export async function resolveReport(id: string): Promise<void> {
  await deleteDoc(doc(db, "reports", id));
}

/**
 * Rejette tous les signalements visant une même recette publique (ex. après
 * suppression de la recette).
 *
 * @param pubId - L'identifiant public de la recette.
 */
export async function resolveReportsForRecipe(pubId: string): Promise<void> {
  const snap = await getDocs(query(collection(db, "reports"), where("pubId", "==", pubId)));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
}

/**
 * Publie un bundle (recette + ses composants) en une transaction batch.
 *
 * @param docs - Les documents publics à écrire (indexés par `pubId`).
 * @returns La promesse de commit.
 */
export async function publishPublicBundle(docs: PublicDoc[]): Promise<void> {
  const batch = writeBatch(db);
  for (const d of docs) batch.set(publicRecipeDoc(d.pubId), d);
  await batch.commit();
}

/**
 * Dépublie un ensemble de docs publics (par `pubId`) en une transaction batch.
 *
 * @param pubIds - Les identifiants publics à supprimer.
 * @returns La promesse de commit (no-op si la liste est vide).
 */
export async function unpublishPublicDocs(pubIds: string[]): Promise<void> {
  if (!pubIds.length) return;
  const batch = writeBatch(db);
  for (const id of pubIds) batch.delete(publicRecipeDoc(id));
  await batch.commit();
}

/**
 * Charge les N recettes publiques les plus récentes (composants inclus ; le
 * filtrage/affichage les écarte). Tri sur `createdAt` → index simple automatique.
 *
 * @param max - Nombre maximum de recettes (défaut 120).
 * @returns Les documents publics, du plus récent au plus ancien.
 */
export async function fetchPublicRecipes(max = 120): Promise<DocumentData[]> {
  const snap = await getDocs(query(publicRecipesCol(), orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map(d => d.data());
}

/**
 * Récupère des composants publics par leurs `pubId` (pour le clone en cascade).
 *
 * @param pubIds - Les identifiants publics recherchés.
 * @returns Les documents existants (dédupliqués).
 */
export async function fetchPublicDocsByIds(pubIds: string[]): Promise<DocumentData[]> {
  const unique = [...new Set(pubIds)].filter(Boolean);
  const snaps = await Promise.all(unique.map(id => getDoc(publicRecipeDoc(id))));
  return snaps.filter(s => s.exists()).map(s => s.data() as DocumentData);
}
