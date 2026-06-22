import { useSwipeDown } from "../hooks/useSwipeDown.js";

// Bottom sheet mobile fermable par swipe vers le bas.
export function SwipeableSheet({ onClose, children, style }) {
  const { sheetRef, onTouchStart, onTouchMove, onTouchEnd } = useSwipeDown(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={sheetRef} className="modal-sheet"
        style={{ touchAction: "pan-y", ...style }}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}>
        <div className="modal-handle" />
        {children}
      </div>
    </div>
  );
}
