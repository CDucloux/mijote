import { createPortal } from "react-dom";
import { useSwipeDown } from "../hooks/useSwipeDown.js";

// Bottom sheet mobile fermable par swipe vers le bas.
// Porté dans <body> : le backdrop `position:fixed` doit échapper aux ancêtres
// `overflow:hidden` / transformés (ex. en-tête de l'Accueil, #root mis à
// l'échelle), sans quoi la feuille se retrouve rognée en haut de l'écran.
// `zIndex` : surcharge le z-index du backdrop (défaut CSS = 200). Utile quand la
// feuille doit passer AU-DESSUS d'un overlay plein écran (ex. fin de cook mode).
export function SwipeableSheet({ onClose, children, style, hideHandle = false, zIndex }) {
  const { sheetRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeDown(onClose);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose} style={zIndex != null ? { zIndex } : undefined}>
      <div ref={sheetRef} className="modal-sheet"
        style={{ touchAction: "pan-y", ...style }}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        {!hideHandle && <div className="modal-handle" />}
        {children}
      </div>
    </div>,
    document.body
  );
}
