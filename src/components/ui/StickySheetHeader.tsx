import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/** Débord vertical de l'en-tête au-dessus de son contenu (cf. `.sheet-sticky-head`). */
const HEAD_BLEED = 12;

// En-tête collant d'un `.modal-sheet` (la feuille est elle-même le conteneur de
// défilement). Le séparateur n'apparaît qu'une fois du contenu passé dessous :
// une sentinelle juste avant l'en-tête sort du cadre au moment où il colle.
export function StickySheetHeader({ children }: { children: ReactNode }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = sentinel?.closest(".modal-sheet");
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting),
      { root, rootMargin: `-${HEAD_BLEED}px 0px 0px 0px` });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (<>
    <div ref={sentinelRef} aria-hidden />
    <div className={`sheet-sticky-head${stuck ? " is-stuck" : ""}`}>{children}</div>
  </>);
}
