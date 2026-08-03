import { createPortal } from "react-dom";
import { useSwipeDown } from "../hooks/useSwipeDown.js";
import { useModalExit } from "../hooks/useModalExit.js";

// Bottom sheet mobile fermable par swipe vers le bas.
// Porté dans <body> : le backdrop `position:fixed` doit échapper aux ancêtres
// `overflow:hidden` / transformés (ex. en-tête de l'Accueil, #root mis à
// l'échelle), sans quoi la feuille se retrouve rognée en haut de l'écran.
// `zIndex` : surcharge le z-index du backdrop (défaut CSS = 200). Utile quand la
// feuille doit passer AU-DESSUS d'un overlay plein écran (ex. fin de cook mode).
//
// `children` accepte une fonction `(close) => …` (render-prop) : `close(cb?)`
// déclenche la MÊME sortie animée que le backdrop/swipe, puis exécute `cb` (ou, à
// défaut, `onClose`) une fois l'animation terminée. Indispensable pour les boutons
// « Annuler » internes, qui sinon démontent la feuille d'un coup, sans animation.
export function SwipeableSheet({ onClose, children, style, hideHandle = false, zIndex }) {
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit(onClose);
  // Backdrop, swipe et Échap déclenchent la sortie animée ; le vrai `onClose`
  // (démontage par le parent) est appelé à la fin de l'animation.
  const { sheetRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeDown(beginClose);
  const setRefs = (el) => { sheetRef.current = el; surfaceRef.current = el; };
  return createPortal(
    <div className={`modal-backdrop${closing ? " is-closing" : ""}`} onClick={() => beginClose()} style={zIndex != null ? { zIndex } : undefined}>
      <div ref={setRefs} className={`modal-sheet${closing ? " is-closing" : ""}`}
        style={{ touchAction: "pan-y", ...style }}
        onClick={e => e.stopPropagation()}
        onAnimationEnd={onAnimationEnd}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        {!hideHandle && <div className="modal-handle" />}
        {typeof children === "function" ? children(beginClose) : children}
      </div>
    </div>,
    document.body
  );
}
