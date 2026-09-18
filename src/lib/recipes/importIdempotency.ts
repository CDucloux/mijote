/**
 * Idempotence des imports IA (côté client) : dérive un identifiant STABLE à partir
 * du contenu à importer. Le serveur met en cache le résultat sous cet identifiant
 * et, si le même import est rejoué (par exemple après une interruption réseau quand
 * l'app passe en arrière-plan), le renvoie SANS re-débiter de crédit ni rappeler le
 * LLM. Deux imports du même contenu partagent donc le même identifiant, ce qui rend
 * l'opération naturellement idempotente sans état à transporter entre les couches.
 *
 * @module recipes/importIdempotency
 */

/**
 * Hash 53 bits déterministe (cyrb53) d'une chaîne, rendu en hexadécimal. Non
 * cryptographique : sert uniquement de clé d'idempotence stable et compacte.
 *
 * @param str - La chaîne à hacher.
 * @returns Un hex de 16 caractères.
 */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

/**
 * Identifiant d'idempotence d'un import, dérivé du type et du contenu principal.
 *
 * @param kind - Le type d'import (`url` | `text` | `pdf` | `photo`).
 * @param payload - Le contenu déterminant (URL, texte, ou données d'images jointes).
 * @returns Un identifiant stable `"{kind}_{hash}"`.
 */
export function importRequestId(kind: string, payload: string): string {
  return `${kind}_${hashString(payload)}`;
}
