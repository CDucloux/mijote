import { useState } from "react";
import { uploadImage, compressImage } from "@/lib/firebase/storage.js";

/** Upload d'image en cours et action d'envoi. */
export interface UseImageUploadResult {
  uploading: boolean;
  /** Envoie le fichier ; résout l'URL à stocker, ou `null` si tout a échoué. */
  upload: (file: Blob) => Promise<string | null>;
}

const readAsDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Lecture impossible")));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/**
 * Upload d'une image vers Firebase Storage, avec repli sur l'image compressée en
 * base64 si Storage échoue (hors ligne, quota) : l'utilisateur garde sa photo
 * plutôt que de perdre sa saisie.
 *
 * @param pathPrefix - Préfixe de rangement Storage (cf. `uploadImage`).
 */
export function useImageUpload(pathPrefix: string): UseImageUploadResult {
  const [uploading, setUploading] = useState(false);
  const upload = async (file: Blob): Promise<string | null> => {
    setUploading(true);
    try {
      return await uploadImage(file, pathPrefix);
    } catch {
      try { return await readAsDataUrl((await compressImage(file)).blob); }
      catch { return null; }
    } finally {
      setUploading(false);
    }
  };
  return { uploading, upload };
}
