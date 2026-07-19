import { createPortal } from "react-dom";
import { useSwipeDown } from "../hooks/useSwipeDown.js";

// Bottom sheet mobile fermable par swipe vers le bas.
// Porté dans <body> : le backdrop `position:fixed` doit échapper aux ancêtres
// `overflow:hidden` / transformés (ex. en-tête de l'Accueil, #root mis à
// l'échelle), sans quoi la feuille se retrouve rognée en haut de l'écran.
export function SwipeableSheet({ onClose, children, style, hideHandle = false }) {
  const { sheetRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeDown(onClose);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
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
