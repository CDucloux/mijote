// ─── GARDE ANTI-SSRF POUR L'IMPORT DEPUIS URL ──────────────────────────────────
// `importRecipeFromUrl` récupère côté serveur une page dont l'URL est fournie par
// l'utilisateur. Sans garde, une URL (ou une redirection) pointant vers une IP
// interne (loopback, réseau privé, link-local, metadata cloud 169.254.169.254…)
// permettrait d'atteindre des services non exposés (SSRF). On résout le nom avant
// chaque requête et on refuse toute adresse non publiquement routable.
import { promises as dns } from "dns";
import { isIP } from "net";

/**
 * Indique si une IP (v4 ou v6) n'est PAS publiquement routable et doit donc être
 * refusée à l'import (loopback, privée, link-local, CGNAT, ULA, mappée IPv4…).
 * Fonction PURE (aucune I/O), pour être testée exhaustivement.
 *
 * @param ip - Une adresse IP littérale (déjà résolue).
 * @returns `true` si l'adresse est bloquée (non publique ou non reconnue).
 */
export function isBlockedIp(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isBlockedIpv4(ip);
  if (kind === 6) return isBlockedIpv6(ip);
  return true; // forme inconnue : on refuse par défaut
}

/** Classe une IPv4 pointée : bloque loopback, privées RFC1918, link-local, CGNAT… */
function isBlockedIpv4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0) return true;                        // 0.0.0.0/8 « ce réseau »
  if (a === 10) return true;                       // 10.0.0.0/8 privé
  if (a === 127) return true;                      // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;         // 169.254.0.0/16 link-local (metadata cloud)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 privé
  if (a === 192 && b === 168) return true;         // 192.168.0.0/16 privé
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0) return true;           // 192.0.0.0/24 (IETF) + 192.0.2.0 doc
  if (a >= 224) return true;                        // 224.0.0.0/4 multicast + 240/4 réservé + 255 broadcast
  return false;
}

/** Classe une IPv6 : bloque loopback, ULA (fc00::/7), link-local (fe80::/10) et
 *  les formes mappées/compatibles IPv4 (dont on reclasse la partie v4). */
function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;         // loopback / non spécifiée
  // IPv4 mappée/compatible (::ffff:a.b.c.d ou ::a.b.c.d) : reclasser la partie v4.
  const mapped = lower.match(/(?:::ffff:|::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  const head = lower.split(":")[0];
  const first = parseInt(head || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true;               // fc00::/7 ULA
  if ((first & 0xffc0) === 0xfe80) return true;               // fe80::/10 link-local
  return false;
}

/** Erreur dédiée : hôte non autorisé (déclenche un message d'import lisible). */
export class BlockedHostError extends Error {
  constructor(host: string) {
    super(`Hôte non autorisé : ${host}`);
    this.name = "BlockedHostError";
  }
}

/**
 * Vérifie qu'un nom d'hôte résout UNIQUEMENT vers des adresses publiques. Résout le
 * nom (A + AAAA) et refuse si l'une des adresses est bloquée (défense contre le
 * rebinding : on teste toutes les résolutions retournées).
 *
 * @param hostname - Le nom d'hôte à vérifier.
 * @throws BlockedHostError si l'hôte ne résout pas ou résout vers une IP interne.
 */
export async function assertHostAllowed(hostname: string): Promise<void> {
  const host = (hostname || "").trim().toLowerCase();
  if (!host) throw new BlockedHostError(hostname);
  // Un littéral IP dans l'URL : on le teste directement (pas de résolution DNS).
  if (isIP(host)) { if (isBlockedIp(host)) throw new BlockedHostError(host); return; }
  let records: { address: string }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new BlockedHostError(host); // hôte introuvable : on refuse plutôt que fetch
  }
  if (!records.length) throw new BlockedHostError(host);
  for (const r of records) if (isBlockedIp(r.address)) throw new BlockedHostError(host);
}
