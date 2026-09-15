/**
 * Extraction du texte d'un fichier PDF côté CLIENT via pdfjs, chargé en dynamique
 * (`await import`) pour ne peser sur le bundle qu'au moment d'un import PDF. On lit
 * uniquement la COUCHE TEXTE du document (aucune vision, aucun rendu de page) : un
 * PDF scanné renvoie donc un texte quasi vide, détecté en amont par
 * {@link hasUsablePdfText}. Le texte propre part ensuite au même pipeline Haiku que
 * l'import « texte collé ».
 *
 * @module recipes/pdfImport
 */
import { normalizePdfText, MAX_PDF_PAGES } from "./pdfText.js";

/** Worker pdfjs configuré une seule fois (le module est réutilisé entre appels). */
let workerConfigured = false;

/**
 * Extrait et normalise le texte d'un PDF (au plus {@link MAX_PDF_PAGES} pages).
 *
 * @param file - Le fichier PDF choisi par l'utilisateur.
 * @returns Le texte assemblé et nettoyé (peut être vide si le PDF est scanné).
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerConfigured) {
    // Worker bundlé par Vite via une URL de module ESM (pas de CDN, pas de copie manuelle).
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    workerConfigured = true;
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
      page.cleanup();
    }
    return normalizePdfText(pages);
  } finally {
    await doc.destroy();
  }
}
