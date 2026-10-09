import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// En-tête collant d'un `.modal-sheet` (la feuille est elle-même le conteneur de
// défilement). La feuille doit être SANS padding haut (`paddingTop: 0`, comme la
// feuille Filtres) : un sticky `top: 0` se colle au bord du scrollport, le contenu
// défilerait sinon dans ce padding, au-dessus de l'en-tête. L'en-tête porte donc
// lui-même cet espace. Le séparateur n'apparaît qu'une fois du contenu passé
// dessous : une sentinelle juste avant l'en-tête sort du cadre dès le défilement.
export function StickySheetHeader({ children }: { children: ReactNode }) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = sentinel?.closest(".modal-sheet");
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { root });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (<>
    <div ref={sentinelRef} aria-hidden />
    <div className={`sheet-sticky-head${stuck ? " is-stuck" : ""}`}>{children}</div>
  </>);
}
