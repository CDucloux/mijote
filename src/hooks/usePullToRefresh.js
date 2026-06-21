import { useState, useEffect, useRef } from "react";

// Détecte un tirage vers le bas UNIQUEMENT quand le conteneur scrollable réel
// sous le doigt est déjà tout en haut (le scroll mobile vit dans des div internes
// en overflow:auto, pas sur window/body). Listener touchmove non-passif pour
// pouvoir bloquer l'overscroll natif pendant le geste.
export function usePullToRefresh(onRefresh, { enabled = true, threshold = 110, max = 170 } = {}) {
  const containerRef = useRef(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const g = useRef({ startY: 0, active: false, pull: 0 });
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    // Le scrollable sous `target` est-il déjà tout en haut ?
    const atTop = (target) => {
      let n = target;
      while (n && n !== el.parentElement) {
        if (n.scrollHeight > n.clientHeight) {
          const oy = getComputedStyle(n).overflowY;
          if (oy === "auto" || oy === "scroll") return n.scrollTop <= 0;
        }
        n = n.parentElement;
      }
      return true; // aucun scrollable trouvé → on considère qu'on est en haut
    };

    const onStart = (e) => {
      if (refreshing || e.touches.length !== 1) { g.current.active = false; return; }
      if (e.target.closest && e.target.closest(".modal-backdrop")) { g.current.active = false; return; }
      if (!atTop(e.target)) { g.current.active = false; return; }
      g.current.startY = e.touches[0].clientY;
      g.current.startX = e.touches[0].clientX;
      g.current.dirLocked = false;
      g.current.active = true;
    };
    const onMove = (e) => {
      if (!g.current.active) return;
      const dy = e.touches[0].clientY - g.current.startY;
      const dx = e.touches[0].clientX - g.current.startX;
      // Lock direction on first significant move — ignore if horizontal
      if (!g.current.dirLocked) {
        if (Math.abs(dx) > Math.abs(dy) + 4) { g.current.active = false; return; }
        if (Math.abs(dy) > 6) g.current.dirLocked = true;
        else return;
      }
      if (dy <= 0) { g.current.pull = 0; setPull(0); return; }
      const dist = Math.min(max, dy * 0.5); // rubber-band
      g.current.pull = dist;
      setPull(dist);
      e.preventDefault(); // bloque l'overscroll natif pendant le tirage
    };
    const onEnd = () => {
      if (!g.current.active) return;
      g.current.active = false;
      if (g.current.pull >= threshold) {
        setRefreshing(true);
        setPull(threshold);                 // reste accroché pendant le refresh
        Promise.resolve().then(() => cb.current?.());
      } else {
        setPull(0);
      }
      g.current.pull = 0;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, refreshing, threshold, max]);

  return { containerRef, pull, refreshing };
}
