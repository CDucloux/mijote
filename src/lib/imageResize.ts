/**
 * Redimensionnement des photos avant import IA. Levier principal sur la latence :
 * une photo de smartphone brute pèse 4-7 Mo ; redimensionnée + ré-encodée en JPEG
 * elle tombe à ~250-400 Ko. On normalise tout en `image/jpeg` → règle au passage le
 * HEIC iPhone (rejeté côté serveur).
 *
 * @module imageResize
 */

/** vision haute résolution (Sonnet lit jusqu'à 2576px) : plus lisible pour l'OCR
 * d'une page de livre, tout en bornant le poids uploadé. */
export const MAX_EDGE = 2000;
export const JPEG_QUALITY = 0.82;
const FALLBACK_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Image préparée : blob JPEG (ou d'origine en repli) + type MIME. */
export interface PreparedImage { blob: Blob; mediaType: string }

/** Dimensions cibles : on ne fait que RÉDUIRE (facteur plafonné à 1, jamais d'upscale). */
export function resizeDimensions(w: number, h: number, maxEdge: number = MAX_EDGE): { width: number; height: number; scale: number } {
  const scale = Math.min(1, maxEdge / Math.max(w, h || 1));
  return { width: Math.round(w * scale), height: Math.round(h * scale), scale };
}

/**
 * File image → JPEG redimensionné. Décode en respectant l'EXIF (une photo portrait
 * ne doit pas arriver couchée : ça dégrade l'OCR), redimensionne sur canvas,
 * ré-encode en JPEG. Repli sur le fichier d'origine si l'API canvas manque — mais
 * seulement pour un type déjà supporté par l'API vision.
 */
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  const canCanvas = typeof createImageBitmap === "function" && typeof document !== "undefined";
  if (!canCanvas) return fallback(file);
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { width, height } = resizeDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback(file);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", JPEG_QUALITY));
    if (!blob) return fallback(file);
    return { blob, mediaType: "image/jpeg" };
  } catch {
    return fallback(file);
  }
}

function fallback(file: File): PreparedImage {
  const type = file?.type || "";
  if (!FALLBACK_TYPES.has(type)) {
    throw new Error("Format d'image non supporté. Utilise une photo JPEG ou PNG.");
  }
  return { blob: file, mediaType: type };
}

/** Blob → base64 (sans le préfixe `data:`). */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const s = String(reader.result || "");
      const comma = s.indexOf(",");
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.readAsDataURL(blob);
  });
}
