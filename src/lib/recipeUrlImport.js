import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase.js";

// ─── IMPORT DE RECETTE DEPUIS UNE URL (client) ───────────────────────────────
// Appelle la Cloud Function `importRecipeFromUrl` (fetch serveur + JSON-LD ou LLM).
// La garde admin est faite CÔTÉ SERVEUR ; ici on ne fait qu'appeler et remonter
// un message d'erreur lisible. Renvoie { recipe, method: "jsonld" | "llm" }.
export async function importRecipeFromUrl(url) {
  const call = httpsCallable(functions, "importRecipeFromUrl", { timeout: 70000 });
  try {
    const res = await call({ url });
    return res.data;
  } catch (e) {
    // Les HttpsError renvoyées par la fonction exposent un `message` propre.
    throw new Error(e?.message || "Import impossible.", { cause: e });
  }
}
