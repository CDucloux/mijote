import { useState, useRef, useEffect, type TouchEvent, type UIEvent } from "react";

/** Gestes et état du pager horizontal à onglets. */
export interface UseEditorSwiperResult<T extends string> {
  section: T;
  swiperRef: React.RefObject<HTMLDivElement | null>;
  /** Va à l'onglet `id` (index `index`) en faisant défiler le pager. */
  goSection: (id: T, index: number) => void;
  handlers: {
    onTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
    onTouchMove: (e: TouchEvent<HTMLDivElement>) => void;
    onTouchEnd: (e: TouchEvent<HTMLDivElement>) => void;
    onScroll: (e: UIEvent<HTMLDivElement>) => void;
  };
}

/**
 * Pager horizontal à onglets de l'éditeur (glisser entre panneaux ou toucher un
 * onglet). Deux pièges réglés ici :
 * - un saut programmé (Infos → Étapes) traverse des panneaux qui ne doivent pas
 *   s'allumer au passage : l'onglet visé est mémorisé jusqu'à son arrivée ;
 * - un défilement vertical dans un panneau ne doit pas faire glisser le pager :
 *   l'axe est verrouillé au premier geste net.
 *
 * @param tabIds - Identifiants des onglets, dans l'ordre des panneaux.
 */
export function useEditorSwiper<T extends string>(tabIds: readonly T[]): UseEditorSwiperResult<T> {
  const [section, setSection] = useState<T>(tabIds[0]);
  const swiperRef = useRef<HTMLDivElement>(null);
  // Onglet visé par un défilement programmé (`null` = défilement libre au doigt).
  const pendingTab = useRef<number | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const touch = useRef({ x: 0, y: 0, axis: null as "x" | "y" | null });
  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const goSection = (id: T, index: number) => {
    setSection(id);
    const el = swiperRef.current;
    if (!el) return;
    const left = index * el.offsetWidth;
    // Déjà en place : ne pas armer la garde, elle ne serait jamais levée (aucun
    // événement de défilement) et bloquerait le balayage au doigt.
    if (Math.abs(el.scrollLeft - left) < 2) { pendingTab.current = null; return; }
    pendingTab.current = index;
    el.scrollTo({ left, behavior: "smooth" });
  };

  return {
    section, swiperRef, goSection,
    handlers: {
      onTouchStart: e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null }; },
      onTouchMove: e => {
        const t = touch.current;
        if (t.axis === null) {
          const dx = Math.abs(e.touches[0].clientX - t.x);
          const dy = Math.abs(e.touches[0].clientY - t.y);
          // Seuil élevé + ratio strict pour éviter les faux déclenchements lors d'un scroll vertical
          if (dx > 20 || dy > 20) t.axis = (dx > dy * 3 && dx > 24) ? "x" : "y";
        }
        e.currentTarget.style.overflowX = t.axis === "y" ? "hidden" : "auto";
      },
      onTouchEnd: e => { e.currentTarget.style.overflowX = "auto"; },
      onScroll: e => {
        const el = e.currentTarget;
        const width = el.offsetWidth || 1;
        const idx = Math.round(el.scrollLeft / width);
        if (pendingTab.current !== null) {
          if (idx === pendingTab.current && Math.abs(el.scrollLeft - idx * width) < 2) pendingTab.current = null;
          // Filet : si le défilement s'interrompt avant la cible (geste concurrent), on
          // rend la main au suivi libre dès qu'il s'est stabilisé.
          clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(() => { pendingTab.current = null; }, 140);
          return;
        }
        setSection(tabIds[idx] ?? tabIds[0]);
      },
    },
  };
}
