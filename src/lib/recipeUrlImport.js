import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase.js";
import { prepareImageForUpload, blobToBase64 } from "./imageResize.js";

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
    // Les HttpsError renvoyées par la fonction exposent un `message` propre.
    throw new Error(e?.message || "Import impossible.", { cause: e });
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
    throw new Error(e?.message || "Import impossible.", { cause: e });
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
