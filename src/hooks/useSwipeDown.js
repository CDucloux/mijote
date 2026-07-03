import { useRef } from "react";

// Conteneur scrollable le plus proche sous le doigt, en remontant jusqu'à la
// sheet (incluse). Certaines feuilles scrollent sur une div interne
// (`overflow:auto`) plutôt que sur `.modal-sheet` : on doit tester CE conteneur,
// sinon le geste de fermeture reste armé alors que le contenu est scrollé.
function nearestScrollable(el, boundary) {
  let node = el;
  while (node && node !== boundary?.parentElement) {
    if (node.scrollHeight > node.clientHeight + 1) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === "auto" || oy === "scroll") return node;
    }
    if (node === boundary) break;
    node = node.parentElement;
  }
  return boundary || null;
}

// Détecte un swipe vers le bas pour fermer un modal mobile (bottom sheet).
// Le geste de fermeture n'est armé que si le conteneur scrollé sous le doigt est
// déjà tout en haut : sinon on laisse le scroll natif faire son travail.
export function useSwipeDown(onClose, threshold = 140) {
  const startY = useRef(null);
  const startX = useRef(null);
  const armed = useRef(false);
  const sheetRef = useRef(null);
  const scrollEl = useRef(null); // conteneur scrollable réellement touché
  const dragging = useRef(false); // true une fois qu'on a « pris la main » sur le geste
  const atTop = () => !scrollEl.current || scrollEl.current.scrollTop <= 0;
  const onTouchStart = e => {
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    dragging.current = false;
    scrollEl.current = nearestScrollable(e.target, sheetRef.current);
    // On n'arme le glisser-pour-fermer que si on est en haut du contenu scrollé.
    armed.current = atTop();
  };
  const onTouchMove = e => {
    if (startY.current === null || !armed.current || !sheetRef.current) return;
    // Si le contenu s'est remis à scroller entre-temps, on rend la main au scroll natif.
    if (!dragging.current && !atTop()) { armed.current = false; sheetRef.current.style.transform = ""; return; }
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
    scrollEl.current = null;
  };
  return { sheetRef, onTouchStart, onTouchMove, onTouchEnd };
}
