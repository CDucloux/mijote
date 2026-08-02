import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase.js";
import { prepareImageForUpload, blobToBase64 } from "./imageResize.js";

// Messages par défaut, par code canonique — utilisés quand le serveur n'a pas
// fourni de message lisible (crash → le message vaut littéralement le code).
const ERROR_MESSAGES = {
  "deadline-exceeded": "L'extraction a pris trop de temps. Réessaie avec une seule page, ou une photo plus nette.",
  "permission-denied": "L'import IA est réservé au créateur pour le moment.",
  "unauthenticated": "Reconnecte-toi pour lancer un import.",
  "failed-precondition": "L'extraction IA n'est pas configurée sur le serveur.",
  "not-found": "Aucune recette n'a été détectée.",
  "unavailable": "Le service n'a pas répondu. Réessaie dans un instant.",
  "resource-exhausted": "Trop de tentatives. Patiente un instant avant de réessayer.",
  "internal": "L'extraction a échoué côté serveur. Réessaie (ou avec une autre photo).",
};

// Normalise une erreur Firebase callable en { message lisible, code } :
// - le code perdu par `new Error(e.message)` est CONSERVÉ (origine visible) ;
// - un message serveur en français prime ; sinon on retombe sur la table.
export function mapImportError(e) {
  const code = String(e?.code || "").replace(/^functions\//, "") || "internal";
  const serverMsg = String(e?.message || "").trim();
  const lisible = serverMsg && serverMsg.toLowerCase() !== code && !/^functions\//.test(serverMsg);
  const message = lisible ? serverMsg : (ERROR_MESSAGES[code] || "L'import a échoué. Réessaie.");
  const err = new Error(message, { cause: e });
  err.code = code;
  return err;
}

// ─── IMPORT DE RECETTE DEPUIS UNE URL (client) ───────────────────────────────
// Appelle la Cloud Function `importRecipeFromUrl` (fetch serveur + JSON-LD ou LLM).
// La garde admin est faite CÔTÉ SERVEUR ; ici on ne fait qu'appeler et remonter
// un message d'erreur lisible. Renvoie { recipe, method: "jsonld" | "llm" }.
export async function importRecipeFromUrl(url, knownUtensils = []) {
  const call = httpsCallable(functions, "importRecipeFromUrl", { timeout: 70000 });
  try {
    const res = await call({ url, knownUtensils });
    return res.data;
  } catch (e) {
    throw mapImportError(e);
  }
}

// ─── IMPORT DEPUIS UNE OU DEUX PHOTOS (livre de cuisine) ─────────────────────
// `images` : [{ mediaType, data(base64) }], max 2. Garde admin côté serveur.
export async function importRecipeFromImages(images, knownUtensils = []) {
  const call = httpsCallable(functions, "importRecipeFromImages", { timeout: 70000 });
  try {
    const res = await call({ images, knownUtensils });
    return res.data;
  } catch (e) {
    throw mapImportError(e);
  }
}

// File image → { mediaType, data(base64 sans préfixe) }. Redimensionne et ré-encode
// en JPEG avant l'encodage base64 (×15 à ×25 sur le poids transféré → l'upload
// mobile ne dépasse plus le timeout de la fonction).
export async function fileToImagePart(file) {
  const { blob, mediaType } = await prepareImageForUpload(file);
  const data = await blobToBase64(blob);
  return { mediaType, data };
}
