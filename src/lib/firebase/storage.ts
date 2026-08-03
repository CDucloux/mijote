/**
 * Compression d'image + upload vers Firebase Storage. Compresse un `File` côté
 * client (redimensionne au bord max). Les images transparentes (PNG/WebP avec
 * canal alpha) sont conservées en PNG pour préserver la transparence ; tout le
 * reste est aplati en JPEG (plus léger).
 *
 * @module storage
 */
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, storage } from "@/lib/firebase/firebase.js";

/** Image compressée : blob + extension + type MIME. */
export interface CompressedImage { blob: Blob; ext: string; contentType: string }

/**
 * Compresse un `File` image côté client : redimensionne au bord max, puis conserve
 * le PNG si l'image a un canal alpha, sinon aplatit en JPEG.
 *
 * @param file - Le fichier image d'origine (`File`, ou tout `Blob` — ex. photo importée).
 * @param options - Paramètres de compression.
 * @param options.maxEdge - Bord le plus long en pixels (défaut 800).
 * @param options.quality - Qualité JPEG entre 0 et 1 (défaut 0.75).
 * @returns Une promesse résolue en `{ blob, ext, contentType }`.
 */
export function compressImage(file: Blob, { maxEdge = 800, quality = 0.75 }: { maxEdge?: number; quality?: number } = {}): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxEdge) { height = Math.round(height * maxEdge / width); width = maxEdge; }
        else if (height > maxEdge) { width = Math.round(width * maxEdge / height); height = maxEdge; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Compression échouée")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        // Detect transparency: PNG/WebP source likely has an alpha channel.
        const maybeTransparent = /image\/(png|webp)/i.test(file.type);
        let keepAlpha = false;
        if (maybeTransparent) {
          try {
            const data = ctx.getImageData(0, 0, width, height).data;
            for (let i = 3; i < data.length; i += 4) {
              if (data[i] < 250) { keepAlpha = true; break; }
            }
          } catch { keepAlpha = maybeTransparent; } // tainted canvas → trust the source type
        }
        if (keepAlpha) {
          canvas.toBlob(
            blob => blob ? resolve({ blob, ext: "png", contentType: "image/png" }) : reject(new Error("Compression échouée")),
            "image/png"
          );
        } else {
          canvas.toBlob(
            blob => blob ? resolve({ blob, ext: "jpg", contentType: "image/jpeg" }) : reject(new Error("Compression échouée")),
            "image/jpeg", quality
          );
        }
      };
      img.onerror = reject;
      img.src = String(e.target?.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compresse puis upload une image vers Firebase Storage.
 *
 * @param file - Le fichier image à envoyer (`File` ou `Blob`).
 * @param pathPrefix - Préfixe de chemin : p.ex. « recipes », « ingredients »,
 *   « utensils » (rangé sous le dossier de l'utilisateur), ou « master/… » (rangé à
 *   la racine, lisible par tous).
 * @returns L'URL de download publique à stocker dans Firestore.
 * @throws Si l'utilisateur n'est pas authentifié.
 */
export async function uploadImage(file: Blob, pathPrefix: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Non authentifié");
  const { blob, ext, contentType } = await compressImage(file);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const path = pathPrefix.startsWith("master/")
    ? `${pathPrefix}/${id}.${ext}`
    : `users/${uid}/${pathPrefix}/${id}.${ext}`;
  const sRef = storageRef(storage, path);
  // cacheControl long : les URLs de download Storage étant stables par objet,
  // le navigateur (et le futur service worker) gardent l'image au lieu de la refetch.
  await uploadBytes(sRef, blob, { contentType, cacheControl: "public, max-age=31536000, immutable" });
  return await getDownloadURL(sRef);
}

/**
 * Supprime une image uploadée par son URL de download (best-effort : les échecs
 * — objet déjà absent, ou n'appartenant pas à l'utilisateur — sont ignorés).
 *
 * @param url - L'URL de download Firebase Storage (les autres URLs sont ignorées).
 * @returns Une promesse résolue une fois la tentative de suppression faite.
 */
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url || !url.includes("firebasestorage")) return;
  try {
    const sRef = storageRef(storage, url);
    await deleteObject(sRef);
  } catch { /* already gone or not ours – ignore */ }
}
