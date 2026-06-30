import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, storage } from "./firebase.js";

// ─── IMAGE COMPRESSION + STORAGE UPLOAD ──────────────────────────────────────
// Compress an image File client-side: resize to max edge.
// Transparent images (PNG/WebP with alpha) are kept as PNG to preserve
// transparency; everything else is flattened to JPEG for smaller size.
// Resolves to { blob, ext, contentType }.
export function compressImage(file, { maxEdge = 800, quality = 0.75 } = {}) {
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
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload a compressed image to Firebase Storage.
// `pathPrefix` is e.g. "recipes", "ingredients", "utensils" (stored under the
// user's folder), or "master/..." (stored at root, readable by all users).
// Returns the public download URL stored in Firestore.
export async function uploadImage(file, pathPrefix) {
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

// Delete a previously uploaded image by its download URL (best-effort).
export async function deleteImageByUrl(url) {
  if (!url || !url.includes("firebasestorage")) return;
  try {
    const sRef = storageRef(storage, url);
    await deleteObject(sRef);
  } catch { /* already gone or not ours – ignore */ }
}
