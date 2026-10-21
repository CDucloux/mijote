import { useCallback, useEffect, useLayoutEffect, useState, type RefObject, type UIEvent } from "react";

// Pagination « à la demande » : on ne monte pas les 80+ cartes d'un coup (coût de
// rendu / images au 1er paint). On affiche un lot, puis l'utilisateur charge la suite.
export const RECIPES_PAGE = 12;

// Dernier jeu de résultats déjà révélé avec l'animation d'entrée. Niveau module
// (survit au démontage de la page) : on n'anime QUE lorsque les résultats changent
// (recherche, tri, carnet), jamais sur un simple retour depuis la fiche détail.
let lastAnimatedGridKey: string | null = null;

// Position de défilement + pagination mémorisées entre deux visites de l'onglet :
// ouvrir une fiche démonte la page, l'état de scroll ne peut donc pas y vivre. Rejoué
// au retour si le jeu de résultats (`key`) est identique, sinon il n'a plus de sens.
let scrollMemo: { key: string | null; top: number; count: number } = { key: null, top: 0, count: RECIPES_PAGE };

interface UseLibraryPagingArgs {
  /** Signature du jeu de résultats (carnet, recherche, tri). */
  gridKey: string;
  /** Les cartes sont révélées (squelette passé, workspace prêt). */
  revealed: boolean;
  scrollRef: RefObject<HTMLElement | null>;
}

/** Pagination et mémoire de défilement exposées par {@link useLibraryPaging}. */
export interface LibraryPaging {
  visibleCount: number;
  /** La grille rejoue sa cascade d'entrée (nouveau jeu de résultats). */
  animateGrid: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  /** À brancher sur `onScroll` du conteneur défilant. */
  rememberScroll: (e: UIEvent<HTMLElement>) => void;
}

/**
 * Pagination de la grille de recettes et mémoire de défilement entre deux visites :
 * le premier lot se recharge à chaque nouveau jeu de résultats, et un retour depuis
 * une fiche retrouve la position et la pagination atteintes, sans rejouer l'animation.
 */
export function useLibraryPaging({ gridKey, revealed, scrollRef }: UseLibraryPagingArgs): LibraryPaging {
  const animateGrid = lastAnimatedGridKey !== gridKey;
  useEffect(() => { if (revealed) lastAnimatedGridKey = gridKey; }, [gridKey, revealed]);

  const [visibleCount, setVisibleCount] = useState(() => (scrollMemo.key === gridKey ? scrollMemo.count : RECIPES_PAGE));
  // Reset quand le jeu de résultats change : ajustement d'état PENDANT le rendu
  // (pattern React recommandé), pas un effet, pour éviter un rendu en cascade.
  const [pagedKey, setPagedKey] = useState(gridKey);
  if (pagedKey !== gridKey) { setPagedKey(gridKey); setVisibleCount(RECIPES_PAGE); }

  // Bref état « spinner » avant de monter le lot suivant : feedback immédiat au tap.
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setTimeout(() => { setVisibleCount(c => c + RECIPES_PAGE); setLoadingMore(false); }, 320);
  };

  // Restaure la position au montage, avant la peinture (aucun saut visible) : la
  // pagination restaurée dans l'état initial a déjà monté les cartes concernées.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && scrollMemo.key === gridKey && scrollMemo.top > 0) el.scrollTop = scrollMemo.top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rememberScroll = useCallback((e: UIEvent<HTMLElement>) => {
    scrollMemo = { key: gridKey, top: e.currentTarget.scrollTop, count: visibleCount };
  }, [gridKey, visibleCount]);

  return { visibleCount, animateGrid, loadingMore, loadMore, rememberScroll };
}
