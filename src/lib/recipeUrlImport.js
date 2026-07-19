import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase.js";

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

// Lit un File image → { mediaType, data(base64 sans préfixe) }.
export function fileToImagePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const s = String(reader.result || "");
      const comma = s.indexOf(",");
      resolve({ mediaType: file.type || "image/jpeg", data: comma >= 0 ? s.slice(comma + 1) : s });
    };
    reader.readAsDataURL(file);
  });
}
