import { useRef, type TouchEvent as ReactTouchEvent } from "react";

/**
 * Conteneur scrollable le plus proche sous le doigt, en remontant jusqu'à la sheet
 * (incluse). Certaines feuilles scrollent sur une div interne (`overflow:auto`)
 * plutôt que sur `.modal-sheet` : on doit tester CE conteneur, sinon le geste de
 * fermeture reste armé alors que le contenu est scrollé.
 */
function nearestScrollable(el: EventTarget | null, boundary: HTMLElement | null): HTMLElement | null {
  let node = el as HTMLElement | null;
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

/**
 * Détecte un swipe vers le bas pour fermer un modal mobile (bottom sheet). Le geste
 * n'est armé que si le conteneur scrollé sous le doigt est déjà tout en haut : sinon
 * on laisse le scroll natif faire son travail.
 *
 * @param onClose - Appelé quand le swipe dépasse le seuil.
 * @param threshold - Distance verticale (px) au-delà de laquelle on ferme (défaut 140).
 * @returns `{ sheetRef, onTouchStart, onTouchMove, onTouchEnd }` à câbler sur la feuille.
 */
export function useSwipeDown(onClose: () => void, threshold = 140) {
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const armed = useRef(false);
  const sheetRef = useRef<HTMLElement | null>(null);
  const scrollEl = useRef<HTMLElement | null>(null); // conteneur scrollable réellement touché
  const dragging = useRef(false); // true une fois qu'on a « pris la main » sur le geste
  const atTop = (): boolean => !scrollEl.current || scrollEl.current.scrollTop <= 0;
  const onTouchStart = (e: ReactTouchEvent): void => {
    startY.current = e.touches[0].clientY;
    startX.current = e.touches[0].clientX;
    dragging.current = false;
    // Réinitialise une éventuelle transition laissée par un retour/fling précédent :
    // le suivi du doigt doit être instantané, pas amorti.
    if (sheetRef.current) sheetRef.current.style.transition = "";
    scrollEl.current = nearestScrollable(e.target, sheetRef.current);
    // On n'arme le glisser-pour-fermer que si on est en haut du contenu scrollé.
    armed.current = atTop();
  };
  const onTouchMove = (e: ReactTouchEvent): void => {
    if (startY.current === null || !armed.current || !sheetRef.current) return;
    // Si le contenu s'est remis à scroller entre-temps, on rend la main au scroll natif.
    if (!dragging.current && !atTop()) { armed.current = false; sheetRef.current.style.transform = ""; return; }
    const dy = e.touches[0].clientY - startY.current;
    const dx = Math.abs(e.touches[0].clientX - (startX.current ?? 0));
    // On ne suit le geste que s'il est franchement vertical & descendant (anti-conflit scroll).
    if (dy > 6 && dy > dx * 1.5) {
      dragging.current = true;
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    } else if (dy <= 0) {
      // remontée : on relâche le drag pour laisser le scroll natif reprendre
      sheetRef.current.style.transform = "";
    }
  };
  const onTouchEnd = (e: ReactTouchEvent): void => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    const dx = Math.abs(e.changedTouches[0].clientX - (startX.current ?? 0));
    const sheet = sheetRef.current;
    const shouldClose = armed.current && dragging.current && dy > threshold && dy > dx;
    if (shouldClose && sheet) {
      // Poursuit le glissement vers le bas jusqu'à disparition, PUIS ferme, sans
      // remettre `transform` à zéro ni rejouer l'animation de sortie (qui ferait
      // « remonter » la feuille avant de la faire redescendre : effet de collision).
      let done = false;
      const finish = (): void => { if (done) return; done = true; onClose(); };
      sheet.style.transition = "transform 0.2s cubic-bezier(0.4,0,1,1)";
      sheet.style.transform = `translateY(${window.innerHeight}px)`;
      sheet.addEventListener("transitionend", finish, { once: true });
      setTimeout(finish, 240); // filet de sécurité si transitionend ne se déclenche pas
    } else {
      // Sous le seuil : retour en douceur à la position (au lieu d'un saut sec).
      if (sheet && dragging.current) { sheet.style.transition = "transform 0.18s ease-out"; sheet.style.transform = ""; }
      else if (sheet) sheet.style.transform = "";
      if (shouldClose) onClose();
    }
    startY.current = null;
    startX.current = null;
    armed.current = false;
    dragging.current = false;
    scrollEl.current = null;
  };
  return { sheetRef, onTouchStart, onTouchMove, onTouchEnd };
}
