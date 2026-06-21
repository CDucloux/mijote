import { useRef } from "react";

// Détecte un swipe vers le bas pour fermer un modal mobile (bottom sheet).
export function useSwipeDown(onClose, threshold = 140) {
  const startY = useRef(null);
  const startX = useRef(null);
  const sheetRef = useRef(null);
  const onTouchStart = e => { startY.current = e.touches[0].clientY; startX.current = e.touches[0].clientX; };
  const onTouchMove = e => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    const dx = Math.abs(e.touches[0].clientX - startX.current);
    // Only follow drag if movement is primarily vertical
    if (dy > 0 && dy > dx && sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = e => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    const dx = Math.abs(e.changedTouches[0].clientX - startX.current);
    if (sheetRef.current) sheetRef.current.style.transform = "";
    if (dy > threshold && dy > dx) onClose();
    startY.current = null;
    startX.current = null;
  };
  return { sheetRef, onTouchStart, onTouchMove, onTouchEnd };
}
