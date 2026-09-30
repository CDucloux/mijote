import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import { useSwipeDown } from "../../hooks/useSwipeDown.js";
import { useModalExit } from "../../hooks/useModalExit.js";

type CloseFn = (cb?: () => void) => void;

interface SwipeableSheetProps {
  onClose: () => void;
  /** `ReactNode`, ou une fonction `(close) => …` (render-prop) : `close(cb?)` déclenche
   *  la même sortie animée que le backdrop/swipe, puis exécute `cb` (ou `onClose`). */
  children?: ReactNode | ((close: CloseFn) => ReactNode);
  style?: CSSProperties;
  hideHandle?: boolean;
  /** Surcharge le z-index du backdrop (défaut CSS = 200). */
  zIndex?: number;
}

// Bottom sheet mobile fermable par swipe vers le bas. Porté dans <body> : le
// backdrop `position:fixed` doit échapper aux ancêtres `overflow:hidden` /
// transformés, sans quoi la feuille se retrouve rognée en haut de l'écran.
export function SwipeableSheet({ onClose, children, style, hideHandle = false, zIndex }: SwipeableSheetProps) {
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit(onClose);
  // Backdrop et Échap déclenchent la sortie animée (keyframe). Le swipe, lui, ferme
  // en PROLONGEANT le glissement du doigt vers le bas puis démonte directement
  // (`onClose`) : rejouer la keyframe ferait remonter la feuille avant de la
  // redescendre (collision). D'où deux callbacks distincts.
  const { sheetRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeDown(onClose);
  const setRefs = (el: HTMLDivElement | null) => { sheetRef.current = el; surfaceRef.current = el; };
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
