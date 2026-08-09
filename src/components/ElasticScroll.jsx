import { useElasticScroll } from "../hooks/useElasticScroll.js";
import { useIsDesktop } from "../hooks/useIsDesktop.js";

// ─── CONTENEUR À OVERSCROLL VERTICAL ÉLASTIQUE (feel natif) ───────────────────
// Enveloppe un contenu défilant verticalement pour lui donner le rubber-band de
// bas de page « à la iOS » : arrivé en bas, continuer à tirer étire le contenu
// avec une résistance croissante, puis ressort. Le haut reste au pull-to-refresh.
// Désactivé sur desktop (souris).
//
// Le montage de la primitive suit celui du conteneur : idéal pour des contenus
// CONDITIONNELS (feuilles/modales) où les refs n'existent qu'à l'ouverture — les
// listeners s'attachent alors au bon moment (contrairement à un hook appelé une
// seule fois au montage de la page parente).
//
// Usage :
//   <ElasticScroll style={{ flex: 1, padding: "0 20px 24px" }}>{contenu}</ElasticScroll>

/**
 * @param max - Amplitude max du rubber-band (px).
 * @param className - Classe(s) sur le conteneur scrollable.
 * @param style - Styles additionnels du conteneur scrollable (`overflow-y` déjà posé).
 * @param contentStyle - Styles additionnels de l'enfant transformé.
 * @param children - Le contenu défilant.
 */
export function ElasticScroll({ max = 90, className, style, contentStyle, children }) {
  const isDesktop = useIsDesktop();
  const { scrollRef, contentRef } = useElasticScroll({ max, disabled: isDesktop });
  return (
    <div ref={scrollRef} className={className} style={{ overflowY: "auto", ...style }}>
      <div ref={contentRef} style={{ minHeight: "100%", ...contentStyle }}>
        {children}
      </div>
    </div>
  );
}
