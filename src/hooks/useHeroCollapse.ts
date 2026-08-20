import { useEffect, useRef } from "react";
import { computeHeroFrame, rubberBand, stretchFactor } from "@/lib/ui/heroCollapse.js";

/** Onglets de la fiche, dans l'ordre (pilote le swipe horizontal et le rendu). */
export const TAB_ORDER = ["Ingrédients", "Ustensiles", "Étapes"] as const;
export type DetailTab = (typeof TAB_ORDER)[number];

/** Hauteurs (px) du hero déplié et de la barre compacte repliée. */
export const HERO_H = 300;
export const BAR_H = 52;
const MOVE_END = HERO_H - BAR_H;      // 248 : course de repli du hero
// Fenêtre très courte et TARDIVE pour le fond/flou de la barre : elle ne se
// matérialise que sur les tout derniers px, quand le hero a fini de se replier.
const BAR_START = MOVE_END - 22;      // 226

type Ref = React.RefObject<HTMLElement | null>;

export interface HeroCollapse {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  heroImgRef: Ref;
  shadeRef: Ref;
  titleRef: Ref;
  srcRef: Ref;
  attribRef: Ref;
  badgesRef: Ref;
  ctrlLRef: Ref;
  ctrlRRef: Ref;
  barRef: Ref;
  spacerRef: Ref;
  barInnerRef: Ref;
  paneRef: Ref;
  swipeHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
}

/**
 * Anime le repli du hero de la fiche recette sur mobile (parallaxe + départ étagé du
 * texte + barre compacte tardive), le sur-défilement élastique en bas d'onglet, le
 * rebond d'inertie et le changement d'onglet par swipe horizontal.
 *
 * Toute l'animation de scroll est écrite DIRECTEMENT dans le DOM via des refs (aucun
 * setState), pour ne jamais re-rendre la fiche (composant lourd) pendant le défilement.
 * La math (progressions, rubber band, étirement) vit dans `@/lib/ui/heroCollapse` et est
 * testée à part ; ce hook ne fait qu'orchestrer effets et écritures DOM.
 *
 * @param isDesktop - Sur desktop, aucun effet mobile n'est monté (layout 2 colonnes).
 * @param activeTab - Onglet actif (borne le swipe et réinitialise l'élastique).
 * @param setActiveTab - Change d'onglet (appelé par le swipe horizontal).
 * @param recipeId - Recalcule la cale de bas au changement de recette.
 */
export function useHeroCollapse(
  isDesktop: boolean,
  activeTab: DetailTab,
  setActiveTab: (t: DetailTab) => void,
  recipeId: string | undefined,
): HeroCollapse {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Refs d'animation : le collapse écrit directement dans le DOM (pas de state),
  // pour ne pas re-rendre ce composant (gros) à chaque frame de scroll.
  const heroImgRef = useRef<HTMLElement | null>(null);
  const shadeRef = useRef<HTMLElement | null>(null);
  const titleRef = useRef<HTMLElement | null>(null);
  const srcRef = useRef<HTMLElement | null>(null);
  const attribRef = useRef<HTMLElement | null>(null);
  const badgesRef = useRef<HTMLElement | null>(null);
  const ctrlLRef = useRef<HTMLElement | null>(null);
  const ctrlRRef = useRef<HTMLElement | null>(null);
  const barRef = useRef<HTMLElement | null>(null);
  const spacerRef = useRef<HTMLElement | null>(null); // cale de bas : garantit assez de défilement pour replier le hero
  const barInnerRef = useRef<HTMLElement | null>(null);
  const paneRef = useRef<HTMLElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number; axis: "x" | "y" | null } | null>(null);

  const swipeHandlers = {
    onTouchStart: (e: React.TouchEvent) => { swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null }; },
    onTouchMove: (e: React.TouchEvent) => {
      const s = swipeStart.current; if (!s || s.axis) return;
      const dx = Math.abs(e.touches[0].clientX - s.x), dy = Math.abs(e.touches[0].clientY - s.y);
      if (dx > 8 || dy > 8) s.axis = dx > dy ? "x" : "y";
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = swipeStart.current; swipeStart.current = null;
      if (!s || s.axis !== "x") return;
      const dx = e.changedTouches[0].clientX - s.x;
      const idx = TAB_ORDER.indexOf(activeTab);
      if (dx < -50 && idx < TAB_ORDER.length - 1) setActiveTab(TAB_ORDER[idx + 1]);
      else if (dx > 50 && idx > 0) setActiveTab(TAB_ORDER[idx - 1]);
    },
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isDesktop) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let bottomPull = 0;  // sur-défilement en bas d'onglet (élastique)

    const applyHeroFrame = () => {
      const f = computeHeroFrame(el.scrollTop, { moveEnd: MOVE_END, barStart: BAR_START, reduce });

      // Image : parallaxe + montée en échelle.
      if (heroImgRef.current) {
        heroImgRef.current.style.transform = reduce
          ? "translateY(0) scale(1)"
          : `translateY(${f.img.translateY.toFixed(2)}px) scale(${f.img.scale.toFixed(4)})`;
      }
      if (shadeRef.current) shadeRef.current.style.opacity = f.shadeOpacity.toFixed(3);

      // Départ ÉTAGÉ : badges, puis source, puis titre → chorégraphie plutôt qu'un
      // fondu unique.
      if (badgesRef.current) {
        badgesRef.current.style.opacity = String(f.badges.opacity);
        badgesRef.current.style.transform = `translateY(${f.badges.translateY.toFixed(2)}px)`;
      }
      for (const r of [srcRef, attribRef]) {
        if (!r.current) continue;
        r.current.style.opacity = String(f.loose.opacity);
        r.current.style.transform = `translateY(${f.loose.translateY.toFixed(2)}px)`;
      }
      if (titleRef.current) {
        titleRef.current.style.opacity = String(f.title.opacity);
        titleRef.current.style.transform =
          `translateY(${f.title.translateY.toFixed(2)}px) scale(${f.title.scale.toFixed(4)})`;
      }

      // Boutons overlay du hero : sortent avant que la barre ne prenne le relais.
      // Opacité UNIQUEMENT (pas de transform) : un ancêtre transformé casserait le
      // position:fixed du menu « … » (il se positionnerait par rapport au conteneur
      // au lieu du viewport) et le placerait sous le titre.
      const oC = f.controls.opacity;
      for (const r of [ctrlLRef, ctrlRRef]) {
        if (!r.current) continue;
        r.current.style.opacity = String(oC);
        r.current.style.pointerEvents = oC < 0.5 ? "none" : "auto";
      }

      // Barre : fond/flou tardifs (pBar), contenu juste après la sortie du titre.
      if (barRef.current) {
        const b = barRef.current.style as CSSStyleDeclaration & { webkitBackdropFilter?: string };
        // Fond OPAQUE une fois replié (pas 0.86) : la bande ne doit jamais laisser
        // transparaître le contenu qui défile dessous.
        b.background = `rgba(var(--bg-rgb),${f.pBar.toFixed(3)})`;
        b.backdropFilter = b.webkitBackdropFilter = `blur(${(18 * f.pBar).toFixed(2)}px)`;
        b.boxShadow = `0 1px 0 rgba(0,0,0,${(0.07 * f.pBar).toFixed(3)})`;
      }
      const oI = f.barInner.opacity;
      if (barInnerRef.current) {
        barInnerRef.current.style.opacity = String(oI);
        barInnerRef.current.style.transform = `translateY(${f.barInner.translateY.toFixed(2)}px)`;
      }
      if (barRef.current) barRef.current.style.pointerEvents = oI > 0.5 ? "auto" : "none";
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; applyHeroFrame(); });
    };

    // ── Rubber band : élastique en bas d'onglet UNIQUEMENT. En haut, on laisse
    // le geste au pull-to-refresh global (pas d'effet ici → plus de conflit avec
    // l'image du hero).
    // Étirement (scaleY) ancré au bas : le contenu ne monte pas, il s'expanse dans le
    // sens du geste. Facteur subtil (≤ 5 %), aligné sur useElasticScroll.
    const applyElastic = (spring: boolean) => {
      const p = paneRef.current;
      if (!p) return;
      // Ressort de retour lent et « posé » (aligné sur useElasticScroll).
      p.style.transition = spring ? "transform 0.9s cubic-bezier(0.16,0.82,0.24,1)" : "none";
      p.style.transformOrigin = "center bottom";
      p.style.transform = bottomPull ? `scaleY(${stretchFactor(bottomPull, el.clientHeight).toFixed(4)})` : "scaleY(1)";
    };

    // Rebond joué par la seule inertie (fling) qui percute le bas : brève expansion
    // puis retour ressort (WAAPI), amplitude proportionnelle à la vitesse résiduelle.
    let bounceAnim: Animation | null = null;
    const playBounce = (amp: number) => {
      const p = paneRef.current;
      if (!p) return;
      bounceAnim?.cancel();
      p.style.transition = "none";
      p.style.transformOrigin = "center bottom";
      p.style.transform = "scaleY(1)";
      bounceAnim = p.animate(
        [
          { transform: "scaleY(1)", easing: "cubic-bezier(0.17,0.84,0.44,1)" },
          { transform: `scaleY(${stretchFactor(amp, el.clientHeight).toFixed(4)})`, offset: 0.28, easing: "cubic-bezier(0.16,0.82,0.24,1)" },
          { transform: "scaleY(1)" },
        ],
        { duration: 900 },
      );
      bounceAnim.onfinish = bounceAnim.oncancel = () => { p.style.transform = "scaleY(1)"; bounceAnim = null; };
    };

    let dragging = false, y0 = 0, mode: "bottom" | "scroll" | null = null;
    const atBottom = () => el.scrollTop >= el.scrollHeight - el.clientHeight - 1;

    const onDown = (e: TouchEvent | MouseEvent) => { bounceAnim?.cancel(); dragging = true; y0 = "touches" in e ? e.touches[0].clientY : e.clientY; mode = null; };
    const onMove = (e: TouchEvent | MouseEvent) => {
      if (!dragging) return;
      // Le swipe horizontal de changement d'onglet est prioritaire.
      if (swipeStart.current?.axis === "x") return;
      const y = "touches" in e ? e.touches[0].clientY : e.clientY;
      const dy = y - y0;
      if (!mode) {
        if (atBottom() && dy < -5) mode = "bottom";
        else if (Math.abs(dy) > 5) mode = "scroll";
      }
      if (reduce) return; // pas d'effet élastique en mouvement réduit
      // On n'étire QUE vers le haut ; inverser le geste relâche proprement (0) sans
      // jamais nourrir `rubber` d'une valeur négative (pas d'emballement).
      if (mode === "bottom") { bottomPull = dy < 0 ? rubberBand(-dy, el.clientHeight) : 0; applyElastic(false); if (bottomPull && e.cancelable) e.preventDefault(); }
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (mode === "bottom") { bottomPull = 0; applyElastic(true); }
      mode = null;
    };

    // Suivi de vélocité : à l'instant où un fling percute le bas (sans doigt), on
    // rejoue un rebond proportionnel. Piggyback sur le listener scroll (qui pilote
    // déjà le hero) ; filtres bon marché d'abord pour éviter tout reflow par frame.
    let lastY = el.scrollTop, lastT = performance.now(), vy = 0;
    const onScroll = () => {
      schedule();
      const now = performance.now(), y = el.scrollTop, dt = now - lastT;
      if (dt > 0) vy = (y - lastY) / dt;
      lastY = y; lastT = now;
      if (reduce || dragging || bottomPull || bounceAnim || vy <= 0.35) return;
      if (el.scrollHeight <= el.clientHeight + 1 || !atBottom()) return;
      playBounce(Math.min(38, vy * 13));
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    // touchmove NON passif : indispensable pour preventDefault() pendant le rubber band.
    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onUp, { passive: true });
    el.addEventListener("touchcancel", onUp, { passive: true });

    applyHeroFrame();

    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onUp);
      el.removeEventListener("touchcancel", onUp);
      if (raf) cancelAnimationFrame(raf);
      bounceAnim?.cancel();
    };
  }, [isDesktop]);

  // Cale de bas : garantit qu'on peut TOUJOURS défiler d'au moins MOVE_END, pour que
  // le hero se replie entièrement même sur une recette à peu de contenu (sinon le
  // collapse reste bloqué à mi-course, en état intermédiaire disgracieux).
  useEffect(() => {
    const el = scrollRef.current, sp = spacerRef.current, pane = paneRef.current;
    if (!el || !sp || isDesktop) return;
    const fit = () => {
      // Mesure fiable : on remet la cale à 0 AVANT de lire scrollHeight (sinon la
      // hauteur de la cale précédente fausse le calcul au changement d'onglet).
      sp.style.height = "0px";
      const contentNoSpacer = el.scrollHeight;                     // hauteur réelle hors cale
      const target = el.clientHeight + MOVE_END + 8;               // +8 : petite marge pour reposer replié
      sp.style.height = `${Math.max(0, target - contentNoSpacer)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    if (pane) ro.observe(pane);   // recalcule au changement de contenu (onglet, images)
    return () => ro.disconnect();
  }, [isDesktop, activeTab, recipeId]);

  // Reset de l'élastique bas au changement d'onglet (évite un panneau décalé).
  useEffect(() => {
    if (paneRef.current) {
      paneRef.current.style.transition = "none";
      paneRef.current.style.transform = "scaleY(1)";
    }
  }, [activeTab]);

  return {
    scrollRef, heroImgRef, shadeRef, titleRef, srcRef, attribRef, badgesRef,
    ctrlLRef, ctrlRRef, barRef, spacerRef, barInnerRef, paneRef, swipeHandlers,
  };
}
