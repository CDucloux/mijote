import { useEffect, useRef } from "react";
import { attachElasticScroll } from "@/lib/ui/elasticScrollCore.js";

/**
 * Overscroll vertical « stretch » au BAS d'un conteneur scrollable : arrivé en bas,
 * continuer à tirer ÉTIRE le contenu (scaleY ancré au bas, le dernier élément reste
 * fixe, ceux au-dessus s'espacent), piloté au doigt, puis revient en ressort au
 * relâcher. Le contenu ne « monte » pas : il s'expanse dans le sens du geste.
 * Volontairement borné au bas, le haut est réservé au pull-to-refresh global (sinon
 * conflit). Neutre en `prefers-reduced-motion`.
 *
 * La mécanique (résistance rubber-band iOS, rebond d'inertie) vit dans
 * `attachElasticScroll` (cf. elasticScrollCore), partagée avec la délégation globale.
 *
 * @param options - Réglages.
 * @param options.max - Décalage maximal en pixels (défaut 38, volontairement subtil).
 * @param options.disabled - Désactive l'effet (ex. desktop).
 * @param options.armWhenUnscrollable - Arme l'étirement sur un geste vers le haut même
 *   quand le contenu tient à l'écran (rien à défiler). Utile sur une page courte (ex.
 *   connexion) pour garder le ressenti élastique ; faux par défaut.
 * @returns `scrollRef` (conteneur `overflow-y`) et `contentRef` (enfant transformé,
 *   englobant tout le contenu défilable).
 *
 * @example
 * ```tsx
 * const { scrollRef, contentRef } = useElasticScroll({ disabled: isDesktop });
 * return <div ref={scrollRef} style={{ overflowY: "auto" }}><div ref={contentRef}>…</div></div>;
 * ```
 */
export function useElasticScroll({ max = 38, disabled = false, armWhenUnscrollable = false }: { max?: number; disabled?: boolean; armWhenUnscrollable?: boolean } = {}) {
  const scrollRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current, inner = contentRef.current;
    if (!el || !inner || disabled) return;
    return attachElasticScroll(el, inner, { max, armWhenUnscrollable });
  }, [max, disabled, armWhenUnscrollable]);

  return { scrollRef, contentRef };
}
