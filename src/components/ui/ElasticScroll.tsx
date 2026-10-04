import { useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode, UIEventHandler } from "react";
import { useElasticScroll } from "../../hooks/useElasticScroll.js";
import { useIsDesktop } from "../../hooks/useIsDesktop.js";

// Conteneur à overscroll vertical élastique (feel natif iOS) : arrivé en bas,
// continuer à tirer étire le contenu avec une résistance croissante, puis ressort.
// Le haut reste au pull-to-refresh. Désactivé sur desktop (souris).
//
// Le montage de la primitive suit celui du conteneur : idéal pour des contenus
// CONDITIONNELS (feuilles/modales) où les refs n'existent qu'à l'ouverture.

interface ElasticScrollProps {
  /** Amplitude max du rubber-band (px). */
  max?: number;
  /** Arme le rebond même quand le contenu tient à l'écran (page courte). Vrai par défaut. */
  armWhenUnscrollable?: boolean;
  /** Classe(s) sur le conteneur scrollable. */
  className?: string;
  /** Styles additionnels du conteneur scrollable (`overflow-y` déjà posé). */
  style?: CSSProperties;
  /** Styles additionnels de l'enfant transformé. */
  contentStyle?: CSSProperties;
  /** Quand sa valeur change, le conteneur repart en haut (scrollTop 0). */
  resetKey?: unknown;
  /** Position restaurée au montage (retour sur la page), au lieu du haut. */
  initialScrollTop?: number;
  /** Écoute du défilement (ex. mémoriser la position entre deux visites). */
  onScroll?: UIEventHandler<HTMLDivElement>;
  /** Le contenu défilant. */
  children?: ReactNode;
}

export function ElasticScroll({ max = 90, armWhenUnscrollable = true, className, style, contentStyle, resetKey, initialScrollTop = 0, onScroll, children }: ElasticScrollProps) {
  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useElasticScroll<HTMLDivElement>({ max, disabled: isDesktop, armWhenUnscrollable });
  const mounted = useRef(false);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = mounted.current ? 0 : initialScrollTop;
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, scrollRef]);
  return (
    <div ref={scrollRef} onScroll={onScroll} className={className} style={{ overflowY: "auto", ...style }}>
      <div ref={contentRef} style={{ minHeight: "100%", ...contentStyle }}>
        {children}
      </div>
    </div>
  );
}
