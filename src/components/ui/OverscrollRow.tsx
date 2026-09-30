import type { CSSProperties, ReactNode } from "react";
import { useIsDesktop } from "../../hooks/useIsDesktop.js";
import { useHorizontalOverscroll } from "../../hooks/useHorizontalOverscroll.js";

// Enveloppe une rangée scrollable horizontalement pour lui donner l'élastique de
// bord « rubber-band » : `stretch` (scaleX ancré au bord, pour des pills/texte) ou
// simple décalage (translateX, pour des images). Désactivé sur desktop (souris).

interface OverscrollRowProps {
  /** `true` : étirement scaleX (pills/texte). `false` : translateX (images). */
  stretch?: boolean;
  /** Amplitude max de l'overscroll (px). */
  max?: number;
  /** Classe(s) sur la rangée interne (flex). */
  className?: string;
  /** Styles additionnels de la rangée interne (gap, padding…). */
  style?: CSSProperties;
  /** Styles additionnels du conteneur scrollable. */
  outerStyle?: CSSProperties;
  /** Les éléments de la rangée. */
  children?: ReactNode;
}

export function OverscrollRow({ stretch = false, max = 72, className, style, outerStyle, children }: OverscrollRowProps) {
  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useHorizontalOverscroll<HTMLDivElement>({ max, stretch, disabled: isDesktop });
  return (
    <div ref={scrollRef} style={{ overflowX: "auto", ...outerStyle }}>
      <div ref={contentRef} className={className} style={{ display: "flex", width: "max-content", minWidth: "100%", ...style }}>
        {children}
      </div>
    </div>
  );
}
