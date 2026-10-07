/**
 * Accès à l'API YouTube Data v3 (I/O). Seul appel : `videos.list?part=snippet`,
 * 1 unité de quota sur les 10 000 gratuites par jour. On passe par l'API plutôt que
 * par la page de lecture : la balise `og:description` est tronquée et YouTube sert
 * une page de consentement aux serveurs européens.
 *
 * @module imports/youtubeApi
 */
import { HttpsError } from "firebase-functions/v2/https";
import { parseYoutubeSnippet, type YoutubeSnippet } from "./youtube.js";

const VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos";
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Récupère le titre, la description et la miniature d'une vidéo publique.
 *
 * @param videoId - Id de la vidéo (validé par `parseYoutubeVideoId`).
 * @param apiKey - Clé API Google restreinte à YouTube Data API v3.
 * @returns Le snippet validé.
 * @throws HttpsError `failed-precondition` si la clé manque ou est refusée,
 *   `not-found` si la vidéo est privée ou supprimée, `unavailable` /
 *   `deadline-exceeded` sur échec réseau.
 */
export async function fetchYoutubeSnippet(videoId: string, apiKey: string): Promise<YoutubeSnippet> {
  if (!apiKey) throw new HttpsError("failed-precondition", "L'import YouTube n'est pas encore configuré (clé API YouTube à renseigner).");
  const url = `${VIDEOS_ENDPOINT}?part=snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") throw new HttpsError("deadline-exceeded", "YouTube a mis trop de temps à répondre.");
    throw new HttpsError("unavailable", "Impossible de joindre YouTube. Réessaie dans un instant.");
  }
  // 400/403 : clé invalide, API non activée ou quota du jour épuisé, jamais la faute de l'utilisateur.
  if (res.status === 400 || res.status === 403) throw new HttpsError("failed-precondition", "L'import YouTube est momentanément indisponible côté serveur.");
  if (!res.ok) throw new HttpsError("unavailable", `YouTube a répondu ${res.status}.`);
  const snippet = parseYoutubeSnippet(await res.json().catch(() => null));
  if (!snippet) throw new HttpsError("not-found", "Cette vidéo est introuvable, privée ou supprimée.");
  return snippet;
}
