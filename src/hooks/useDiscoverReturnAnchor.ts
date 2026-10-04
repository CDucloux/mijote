import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Entrées : recette publique ouverte, retour à une vue d'onglet, onglet courant. */
export interface DiscoverReturnAnchorInput {
  publicPubId: string | null | undefined;
  atTabView: boolean;
  tab: string;
}

/**
 * Au retour d'une recette publique, recale « Découvrir » sur la carte cliquée via
 * son ancre (`#discover-card-<pubId>`), carrousels horizontaux compris.
 * `scrollIntoView` est agnostique du conteneur ; on réessaie tant que la carte
 * n'existe pas encore (feed rechargé de façon asynchrone au remontage).
 *
 * @param input - Signaux de navigation courants.
 * @returns `true` tant que l'onglet doit rester masqué (calage en cours, sans flash en haut).
 */
export function useDiscoverReturnAnchor({ publicPubId, atTabView, tab }: DiscoverReturnAnchorInput): boolean {
  const lastPubId = useRef<string | null>(null);
  const wasAtTabView = useRef(true);
  const [hold, setHold] = useState(false);
  useEffect(() => { if (publicPubId) lastPubId.current = publicPubId; }, [publicPubId]);

  useLayoutEffect(() => {
    const returning = atTabView && !wasAtTabView.current;
    wasAtTabView.current = atTabView;
    const anchor = lastPubId.current;
    if (!returning || !anchor) return;
    lastPubId.current = null;
    // L'ancre ne vit QUE dans le feed de l'Accueil : ailleurs, masquer tiendrait
    // l'écran blanc jusqu'à l'échéance pour rien.
    if (tab !== "home") return;
    setHold(true);
    // Filet court : le feed est réhydraté depuis le cache, l'ancre arrive vite.
    const deadline = Date.now() + 1200;
    let raf = 0;
    const tryScroll = () => {
      const el = document.getElementById(`discover-card-${anchor}`);
      if (el) { el.scrollIntoView({ block: "center", behavior: "auto" }); setHold(false); return; }
      if (Date.now() < deadline) raf = requestAnimationFrame(tryScroll);
      else setHold(false);
    };
    tryScroll();
    return () => cancelAnimationFrame(raf);
  }, [atTabView, tab]);

  return hold;
}
