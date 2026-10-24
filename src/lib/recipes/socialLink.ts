/**
 * Liens de réseaux sociaux à l'import (reel Instagram, vidéo TikTok). Le serveur
 * n'y lit que la légende du post, best-effort : l'écran d'import prévient dès la
 * saisie et, si la légende reste illisible, renvoie vers l'import par texte.
 *
 * @module recipes/socialLink
 */

/** Réseau social reconnu dans un lien d'import. */
export type SocialPlatform = "instagram" | "tiktok";

/** Nom affiché de chaque réseau. */
export const SOCIAL_LABEL: Record<SocialPlatform, string> = { instagram: "Instagram", tiktok: "TikTok" };

const PLATFORM_HOSTS: Record<SocialPlatform, string[]> = {
  instagram: ["instagram.com", "instagr.am"],
  tiktok: ["tiktok.com"],
};

/** Motif d'échec renvoyé par le serveur quand la légende d'un post est inexploitable. */
export const SOCIAL_CAPTION_REASON = "social-caption";

/**
 * Réseau social désigné par un lien saisi, ou `null` pour un site ordinaire.
 *
 * @param url - Le lien saisi (forme quelconque, éventuellement incomplète).
 * @returns Le réseau reconnu, ou `null`.
 */
export function socialPlatformOf(url: string): SocialPlatform | null {
  let host: string;
  try { host = new URL(url.trim()).hostname.toLowerCase(); } catch { return null; }
  for (const [platform, domains] of Object.entries(PLATFORM_HOSTS) as [SocialPlatform, string[]][]) {
    if (domains.some(domain => host === domain || host.endsWith(`.${domain}`))) return platform;
  }
  return null;
}

/**
 * L'échec vient d'une légende sociale illisible (motif serveur
 * {@link SOCIAL_CAPTION_REASON}) : l'écran propose alors l'import par texte.
 *
 * @param error - L'erreur remontée, de forme non garantie (`catch`).
 * @returns `true` pour un échec de légende sociale.
 */
export function isSocialCaptionError(error: unknown): boolean {
  return !!error && typeof error === "object" && "reason" in error && error.reason === SOCIAL_CAPTION_REASON;
}
