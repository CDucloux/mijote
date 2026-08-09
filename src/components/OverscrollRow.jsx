import { useIsDesktop } from "../hooks/useIsDesktop.js";
import { useHorizontalOverscroll } from "../hooks/useHorizontalOverscroll.js";

// ─── RANGÉE À OVERSCROLL ÉLASTIQUE (feel natif) ──────────────────────────────
// Enveloppe une rangée scrollable horizontalement pour lui donner l'élastique de
// bord « rubber-band » : `stretch` (scaleX ancré au bord, pour des pills/texte) ou
// simple décalage (translateX, pour des images). Désactivé sur desktop (souris).
//
// Usage :
//   <OverscrollRow stretch className="my-row" style={{ gap: 10 }}>
//     {pills}
//   </OverscrollRow>
// Le conteneur externe porte l'`overflow-x`; l'enfant transformé englobe le contenu.

/**
 * @param stretch - `true` : étirement scaleX (pills/texte). `false` : translateX (images).
 * @param max - Amplitude max de l'overscroll (px).
 * @param className - Classe(s) sur la rangée interne (flex).
 * @param style - Styles additionnels de la rangée interne (gap, padding…).
 * @param outerStyle - Styles additionnels du conteneur scrollable.
 * @param children - Les éléments de la rangée.
 */
export function OverscrollRow({ stretch = false, max = 72, className, style, outerStyle, children }) {
  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useHorizontalOverscroll({ max, stretch, disabled: isDesktop });
  return (
    <div ref={scrollRef} style={{ overflowX: "auto", ...outerStyle }}>
      <div ref={contentRef} className={className} style={{ display: "flex", width: "max-content", minWidth: "100%", ...style }}>
        {children}
      </div>
    </div>
  );
}
