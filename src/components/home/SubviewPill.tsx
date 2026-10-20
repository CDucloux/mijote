import { useRef, useCallback, useEffect, useLayoutEffect, type RefObject } from "react";

// Sélecteur de sous-vue de l'Accueil : « À suivre » (tableau de bord perso) vs
// « Découvrir » (recettes de la communauté). Chaque segment porte sa propre route
// (/home ↔ /discover) ; l'onglet reste unique dans la barre de navigation.
// Le fond actif est porté par UN seul « thumb » qui GLISSE d'un segment à l'autre
// (au lieu d'un fond qui apparaît/disparaît par segment). On mesure le segment actif
// et on positionne le thumb par-dessus. La glisse ne doit répondre qu'à l'action de
// l'utilisateur : au montage, au resize et après le chargement des polices (largeur
// dépendante de la fonte), on repositionne SANS transition.
/** Sous-vue de l'Accueil. */
export type HomeSubview = "home" | "discover";

export function SubviewPill({ mode, onNavigate }: { mode: HomeSubview; onNavigate?: (mode: HomeSubview) => void }) {
  const homeRef = useRef<HTMLButtonElement>(null);
  const discoverRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const animatedRef = useRef(false);

  const placeThumb = useCallback((animate: boolean) => {
    const active = mode === "discover" ? discoverRef.current : homeRef.current;
    const thumb = thumbRef.current;
    if (!active || !thumb) return;
    const reduce = animate && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduce) thumb.style.transition = "none";
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
    if (!animate || reduce) requestAnimationFrame(() => { thumb.style.transition = ""; });
  }, [mode]);

  // Positionne au changement de mode : la première passe (montage) ne glisse pas.
  useLayoutEffect(() => {
    placeThumb(animatedRef.current);
    animatedRef.current = true;
  }, [mode, placeThumb]);

  // Recalage sans glisse au resize et après chargement des polices.
  useEffect(() => {
    const replace = () => placeThumb(false);
    window.addEventListener("resize", replace);
    if (document.fonts?.ready) document.fonts.ready.then(replace);
    return () => window.removeEventListener("resize", replace);
  }, [placeThumb]);

  const seg = (id: HomeSubview, label: string, ref: RefObject<HTMLButtonElement | null>) => {
    const active = mode === id;
    return (
      <button ref={ref}
        role="tab" aria-selected={active} onClick={() => onNavigate?.(id)}
        className={`pressable${active ? "" : " hover-text"}`}
        style={{
          position: "relative", zIndex: 1, flex: "0 0 auto", padding: "7px 16px", borderRadius: 999,
          border: "none", cursor: "pointer", background: "transparent",
          fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em",
          color: active ? "var(--text)" : undefined,
          transition: "color 0.22s ease",
        }}>
        {label}
      </button>
    );
  };
  return (
    <div role="tablist" aria-label="Vue de l'accueil" className="subview-pill" style={{ position: "relative", display: "inline-flex", gap: 3, padding: 3, borderRadius: 999, border: "1px solid var(--border)" }}>
      <span ref={thumbRef} aria-hidden="true" className="subview-thumb" style={{
        position: "absolute", top: 3, left: 0, zIndex: 0, height: "calc(100% - 6px)", borderRadius: 999,
        boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
        transition: "transform 0.28s cubic-bezier(0.4,0.08,0.16,1), width 0.28s cubic-bezier(0.4,0.08,0.16,1)",
      }} />
      {seg("home", "À suivre", homeRef)}
      {seg("discover", "Découvrir", discoverRef)}
    </div>
  );
}
