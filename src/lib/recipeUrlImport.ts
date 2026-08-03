/**
 * Import de recette depuis une URL ou des photos (client). Appelle les Cloud
 * Functions `importRecipeFromUrl` / `importRecipeFromImages` et remonte un message
 * d'erreur lisible. La garde admin est faite CÔTÉ SERVEUR.
 *
 * @module recipeUrlImport
 */
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { functions } from "./firebase.js";
import { prepareImageForUpload, blobToBase64 } from "./imageResize.js";

/** Erreur d'import : conserve le `code` canonique Firebase (origine visible). */
export interface ImportError extends Error { code: string }

// Messages par défaut, par code canonique — utilisés quand le serveur n'a pas
// fourni de message lisible (crash → le message vaut littéralement le code).
const ERROR_MESSAGES: Record<string, string> = {
  "deadline-exceeded": "L'extraction a pris trop de temps. Réessaie avec une seule page, ou une photo plus nette.",
  "permission-denied": "L'import IA est réservé au créateur pour le moment.",
  "unauthenticated": "Reconnecte-toi pour lancer un import.",
  "failed-precondition": "L'extraction IA n'est pas configurée sur le serveur.",
  "not-found": "Aucune recette n'a été détectée.",
  "unavailable": "Le service n'a pas répondu. Réessaie dans un instant.",
  "resource-exhausted": "Trop de tentatives. Patiente un instant avant de réessayer.",
  "internal": "L'extraction a échoué côté serveur. Réessaie (ou avec une autre photo).",
};

/**
 * Normalise une erreur Firebase callable en `Error` lisible + `code` :
 * - le code perdu par `new Error(e.message)` est CONSERVÉ (origine visible) ;
 * - un message serveur en français prime ; sinon on retombe sur la table.
 */
export function mapImportError(e: unknown): ImportError {
  const err = e as { code?: string; message?: string } | null;
  const code = String(err?.code || "").replace(/^functions\//, "") || "internal";
  const serverMsg = String(err?.message || "").trim();
  const lisible = serverMsg && serverMsg.toLowerCase() !== code && !/^functions\//.test(serverMsg);
  const message = lisible ? serverMsg : (ERROR_MESSAGES[code] || "L'import a échoué. Réessaie.");
  const out = new Error(message, { cause: e }) as ImportError;
  out.code = code;
  return out;
}

/**
 * Import de recette depuis une URL. Appelle `importRecipeFromUrl` (fetch serveur +
 * JSON-LD ou LLM). Renvoie `{ recipe, method: "jsonld" | "llm" }`.
 */
export async function importRecipeFromUrl(url: string, knownUtensils: string[] = []): Promise<unknown> {
  const call = httpsCallable(functions, "importRecipeFromUrl", { timeout: 70000 });
  try {
    const res = await call({ url, knownUtensils });
    return res.data;
  } catch (e) {
    throw mapImportError(e);
  }
}

/** Partie image envoyée au serveur : type MIME + données base64 (sans préfixe). */
export interface ImagePart { mediaType: string; data: string }

/**
 * Import depuis une ou deux photos (livre de cuisine). `images` : max 2. Garde
 * admin côté serveur.
 */
export async function importRecipeFromImages(images: ImagePart[], knownUtensils: string[] = []): Promise<unknown> {
  const call = httpsCallable(functions, "importRecipeFromImages", { timeout: 115000 });
  try {
    const res: HttpsCallableResult = await call({ images, knownUtensils });
    return res.data;
  } catch (e) {
    throw mapImportError(e);
  }
}

/**
 * File image → `{ mediaType, data(base64 sans préfixe) }`. Redimensionne et
 * ré-encode en JPEG avant l'encodage base64 (×15 à ×25 sur le poids transféré →
 * l'upload mobile ne dépasse plus le timeout de la fonction).
 */
export async function fileToImagePart(file: File): Promise<ImagePart> {
  const { blob, mediaType } = await prepareImageForUpload(file);
  const data = await blobToBase64(blob);
  return { mediaType, data };
}
