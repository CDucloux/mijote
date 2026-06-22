import { useRef } from "react";

// Détecte un swipe vers le bas pour fermer un modal mobile (bottom sheet).
// Le geste de fermeture n'est armé que si le contenu est déjà scrollé tout en
// haut : sinon on laisse le scroll natif faire son travail (sheet longue).
export function useSwipeDown(onClose, threshold = 140) {
  const startY = useRef(null);
  const startX = useRef(null);
  const armed = useRef(false);
  const sheetRef = useRef(null);
  const onTouchStart = e => {
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    // On n'arme le glisser-pour-fermer que si on est en haut du contenu.
    armed.current = !sheetRef.current || sheetRef.current.scrollTop <= 0;
  };
  const onTouchMove = e => {
    if (startY.current === null || !armed.current) return;
    const dy = e.touches[0].clientY - startY.current;
    const dx = Math.abs(e.touches[0].clientX - startX.current);
    // Only follow drag if movement is primarily vertical & downward.
    if (dy > 0 && dy > dx && sheetRef.current) sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onTouchEnd = e => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    const dx = Math.abs(e.changedTouches[0].clientX - startX.current);
    if (sheetRef.current) sheetRef.current.style.transform = "";
    if (armed.current && dy > threshold && dy > dx) onClose();
    startY.current = null;
    startX.current = null;
    armed.current = false;
  };
  return { sheetRef, onTouchStart, onTouchMove, onTouchEnd };
}
