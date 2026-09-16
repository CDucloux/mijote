/**
 * Normalisation du texte extrait d'un PDF (logique pure, sans I/O ni pdfjs).
 * L'extraction bas niveau (pdfjs, lecture du fichier) vit dans `pdfImport.ts` ;
 * ici on met en forme les fragments bruts en un texte propre, prêt à envoyer au
 * modèle, et on décide s'il est exploitable (un PDF scanné ne renvoie quasiment
 * aucune couche texte).
 *
 * @module recipes/pdfText
 */

/**
 * Longueur minimale d'un texte de PDF exploitable. En deçà, on considère le PDF
 * comme scanné (sans couche texte) : rien à extraire. Aligné sur `MIN_TEXT_LEN`
 * du serveur pour un rejet cohérent des deux côtés.
 */
export const MIN_PDF_TEXT_LEN = 40;

/** Nombre maximal de pages lues (borne le coût et le temps d'extraction). */
export const MAX_PDF_PAGES = 30;

/**
 * Assemble et nettoie les textes de pages d'un PDF : concatène par saut de ligne
 * double, réduit les espaces multiples, retire les espaces de fin de ligne et
 * limite les lignes vides consécutives, pour un texte lisible par le modèle.
 *
 * @param pages - Le texte brut de chaque page (dans l'ordre de lecture).
 * @returns Le texte assemblé et normalisé (peut être vide).
 */
export function normalizePdfText(pages: string[]): string {
  return (pages || [])
    .map((p) => String(p ?? "")
      .replace(/[ \t ]+/g, " ")   // espaces multiples (dont insécables) -> un seul
      .replace(/ *\n */g, "\n")         // espaces autour des sauts de ligne
      .replace(/\n{3,}/g, "\n\n")      // au plus une ligne vide
      .trim())
    .filter((p) => p.length > 0)
    .join("\n\n")
    .trim();
}

/**
 * Indique si un texte de PDF est assez fourni pour tenter une extraction.
 *
 * @param text - Le texte normalisé.
 * @returns `true` si le texte atteint la longueur minimale exploitable.
 */
export function hasUsablePdfText(text: string): boolean {
  return (text || "").trim().length >= MIN_PDF_TEXT_LEN;
}
