import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { computeTooltipPosition } from "@/lib/ui/tooltipPosition.js";

// ─── CALQUE DE TOOLTIP GLOBAL ─────────────────────────────────────────────────
// Remplace le tooltip natif brut du navigateur par une bulle stylée (voir
// .app-tooltip). Monté une seule fois : un écouteur délégué repère n'importe quel
// élément porteur d'un attribut `title`, neutralise le tooltip natif (title retiré
// puis restauré à la sortie, donc l'accessibilité et le fallback survivent) et
// affiche la bulle positionnée par computeTooltipPosition.
//
// Souris uniquement : au toucher il n'y a pas de survol, donc aucune bulle. Le
// focus clavier l'affiche aussi (a11y). La logique de placement pure est testée
// dans src/lib/ui/tooltipPosition.
//
// Tactile (mobile) : la bulle est entièrement désactivée. Le survol n'existe pas
// au doigt, mais un simple tap donne le focus à un bouton et ferait apparaître la
// bulle via `focusin`, ce qui parasite l'UX. Sur un appareil sans survol
// (`hover: none`), on ne pose aucun écouteur et rien ne s'affiche jamais.

const SHOW_DELAY = 320; // ms avant apparition : évite le clignotement au survol de passage

export function TooltipLayer() {
  const [tip, setTip] = useState(null);   // { text, rect } de la cible, ou null
  const [shown, setShown] = useState(false);
  const bubbleRef = useRef(null);
  const activeRef = useRef(null);          // { el, title } dont le title natif est neutralisé
  const timerRef = useRef(0);

  useEffect(() => {
    // Appareil tactile sans survol : pas d'infobulles du tout (voir en-tête).
    if (typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches) return;
    // Rend son title natif à l'élément neutralisé (restauration = fallback + a11y).
    const restore = () => {
      const a = activeRef.current;
      if (a?.el && a.title != null) { try { a.el.setAttribute("title", a.title); } catch { /* détaché du DOM */ } }
      activeRef.current = null;
    };
    const hide = () => {
      clearTimeout(timerRef.current);
      restore();
      setShown(false);
      setTip(null);
    };
    // Neutralise le title natif d'un élément et retient sa valeur pour la restaurer.
    const capture = (el) => {
      const title = el.getAttribute("title");
      if (!title || !title.trim()) return null;
      restore();
      activeRef.current = { el, title };
      el.removeAttribute("title");
      return title.trim();
    };

    const onOver = (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      const el = e.target?.closest?.("[title]");
      if (!el || activeRef.current?.el === el) return;
      clearTimeout(timerRef.current);
      const text = capture(el);
      if (!text) return;
      const rect = el.getBoundingClientRect();
      timerRef.current = setTimeout(() => setTip({ text, rect }), SHOW_DELAY);
    };
    const onOut = (e) => {
      const el = activeRef.current?.el;
      if (!el) return;
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      if (e.target !== el && !el.contains(e.target)) return;
      hide();
    };
    const onFocus = (e) => {
      const el = e.target?.closest?.("[title]");
      if (!el) return;
      const text = capture(el);
      if (!text) return;
      setTip({ text, rect: el.getBoundingClientRect() });
    };
    const onKey = (e) => { if (e.key === "Escape") hide(); };

    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", hide, true);
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(timerRef.current);
      restore();
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", hide, true);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, []);

  // Positionne la bulle une fois mesurée, puis déclenche la transition d'entrée.
  useLayoutEffect(() => {
    if (!tip || !bubbleRef.current) return;
    const b = bubbleRef.current;
    const pos = computeTooltipPosition(tip.rect, { width: b.offsetWidth, height: b.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight });
    b.style.left = `${pos.left}px`;
    b.style.top = `${pos.top}px`;
    b.style.setProperty("--caret-x", `${pos.caretLeft}px`);
    b.setAttribute("data-placement", pos.placement);
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div ref={bubbleRef} className="app-tooltip" role="tooltip" data-show={shown ? "1" : undefined}>
      {tip.text}
    </div>,
    document.body,
  );
}
