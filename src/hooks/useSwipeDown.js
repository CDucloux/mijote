import { useRef } from "react";

// Détecte un swipe vers le bas pour fermer un modal mobile (bottom sheet).
// Le geste de fermeture n'est armé que si le contenu est déjà scrollé tout en
// haut : sinon on laisse le scroll natif faire son travail (sheet longue).
export function useSwipeDown(onClose, threshold = 140) {
  const startY = useRef(null);
  const startX = useRef(null);
  const armed = useRef(false);
  const sheetRef = useRef(null);
  const dragging = useRef(false); // true une fois qu'on a « pris la main » sur le geste
  const onTouchStart = e => {
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    dragging.current = false;
    // On n'arme le glisser-pour-fermer que si on est en haut du contenu.
    armed.current = !sheetRef.current || sheetRef.current.scrollTop <= 0;
  };
  const onTouchMove = e => {
    if (startY.current === null || !armed.current || !sheetRef.current) return;
    // Si le contenu s'est remis à scroller entre-temps, on rend la main au scroll natif.
    if (!dragging.current && sheetRef.current.scrollTop > 0) { armed.current = false; sheetRef.current.style.transform = ""; return; }
    const dy = e.touches[0].clientY - startY.current;
    const dx = Math.abs(e.touches[0].clientX - startX.current);
    // On ne suit le geste que s'il est franchement vertical & descendant (anti-conflit scroll).
    if (dy > 6 && dy > dx * 1.5) {
      dragging.current = true;
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    } else if (dy <= 0) {
      // remontée : on relâche le drag pour laisser le scroll natif reprendre
      sheetRef.current.style.transform = "";
    }
  };
  const onTouchEnd = e => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    const dx = Math.abs(e.changedTouches[0].clientX - startX.current);
    if (sheetRef.current) sheetRef.current.style.transform = "";
    if (armed.current && dragging.current && dy > threshold && dy > dx) onClose();
    startY.current = null;
    startX.current = null;
    armed.current = false;
    dragging.current = false;
  };
  return { sheetRef, onTouchStart, onTouchMove, onTouchEnd };
}
