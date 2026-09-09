import { useCallback, useMemo } from "react";
import { useLS } from "./useLS.js";

/** Utilisateur minimal dont on tire l'id pour cloisonner les favoris. */
interface FavUser { uid?: string | null }

/** Surface exposée par {@link useDiscoverFavorites}. */
export interface DiscoverFavorites {
  /** Ensemble des `pubId` favoris (lecture O(1)). */
  favorites: Set<string>;
  /** Liste ordonnée des `pubId` favoris (ordre d'ajout), pour la rangée « Mes favoris ». */
  favIds: string[];
  favCount: number;
  isFavorite: (pubId: string) => boolean;
  toggleFavorite: (pubId: string) => void;
}

/**
 * Favoris « Découvrir » propres à l'utilisateur, DISTINCTS des préférences
 * alimentaires. Persistés localement par uid (offline-first) via `useLS` ; la clé
 * change avec le compte, si bien qu'un changement d'utilisateur recharge ses favoris.
 *
 * @param user - Utilisateur courant (l'uid cloisonne la clé de stockage).
 * @returns L'ensemble des favoris et les actions de lecture/bascule.
 */
export function useDiscoverFavorites(user: FavUser | null | undefined): DiscoverFavorites {
  const uid = user?.uid || "anon";
  const [favIds, setFavIds] = useLS<string[]>(`mijote_discover_favorites_${uid}`, []);
  const favorites = useMemo(() => new Set(favIds), [favIds]);
  const isFavorite = useCallback((pubId: string) => favorites.has(pubId), [favorites]);
  const toggleFavorite = useCallback((pubId: string) => {
    if (!pubId) return;
    setFavIds(prev => prev.includes(pubId) ? prev.filter(id => id !== pubId) : [...prev, pubId]);
  }, [setFavIds]);
  return { favorites, favIds, favCount: favIds.length, isFavorite, toggleFavorite };
}
