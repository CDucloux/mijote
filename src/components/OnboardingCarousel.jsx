import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── ONBOARDING – CARROUSEL DE BIENVENUE ──────────────────────────────────────
// S'affiche une seule fois à la première connexion (flag localStorage par uid).
// Cards défilables horizontalement (scroll-snap) : la carte active est centrée,
// les voisines dépassent de chaque côté. Portalisé dans <body>.
const seenKey = (uid) => `mijote_onboarded_${uid}`;

const SLIDES = [
  { icon: "sparkle", color: "#e8703a", title: "Bienvenue sur Mijoté", text: "Tes recettes, ton planning, tes courses et ton stock, enfin réunis au même endroit et synchronisés partout." },
  { icon: "book", color: "#e8703a", title: "Tes recettes, bien rangées", text: "Crée et organise tes recettes dans des carnets. Suis-les en pas à pas, avec les gestes techniques expliqués et un indice de difficulté." },
  { icon: "calendar", color: "#5b9cf6", title: "Planifie ta semaine", text: "Glisse tes recettes sur le planning des repas, midi et soir. Exporte le tout vers ton agenda en un tap." },
  { icon: "shopping", color: "#e8703a", title: "Courses et stock, automatiques", text: "Génère ta liste de courses depuis ton planning, coche au fur et à mesure, et garde un œil sur ton stock." },
  { icon: "globe", color: "#c080e0", title: "Découvre et partage", text: "Explore les recettes de la communauté, filtre par saison, cuisine ou Nutri-Score, et publie les tiennes." },
  { icon: "home", color: "#e8703a", title: "Cuisinez à plusieurs", text: "Crée un foyer et partagez recettes, courses, planning et stock en temps réel. À vous de jouer !" },
];

export function OnboardingCarousel() {
  const { user } = useAppShell();
  const [show, setShow] = useState(false);
  const [active, setActive] = useState(0);
  const scrollerRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!user?.uid) return;
    let seen = false;
    try { seen = localStorage.getItem(seenKey(user.uid)) === "1"; } catch { /* ignore */ }
    if (!seen) setShow(true);
  }, [user]);

  // Rejouable à la demande (menu avatar « Revoir l'introduction »).
  useEffect(() => {
    const replay = () => { setActive(0); setShow(true); };
    window.addEventListener("mijote:show-onboarding", replay);
    return () => window.removeEventListener("mijote:show-onboarding", replay);
  }, []);

  // À l'ouverture : on repart de la première carte.
  useEffect(() => {
    if (show && scrollerRef.current) { scrollerRef.current.scrollLeft = 0; setActive(0); }
  }, [show]);

  const finish = () => {
    try { if (user?.uid) localStorage.setItem(seenKey(user.uid), "1"); } catch { /* ignore */ }
    setShow(false);
  };

  // Carte la plus proche du centre du scroller → index actif.
  const onScroll = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = scrollerRef.current;
      if (!el) return;
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0, bestD = Infinity;
      [...el.children].forEach((c, n) => {
        const center = c.offsetLeft + c.offsetWidth / 2;
        const d = Math.abs(center - mid);
        if (d < bestD) { bestD = d; best = n; }
      });
      setActive(best);
    });
  };

  const goTo = (n) => {
    const el = scrollerRef.current;
    if (el?.children[n]) el.children[n].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };
  const next = () => (active < SLIDES.length - 1 ? goTo(active + 1) : finish());

  if (!show) return null;
  const last = active === SLIDES.length - 1;

  const CARD_W = "min(78vw, 300px)"; // largeur d'une carte (mobile vw, plafond desktop)

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "20px 0", animation: "fadeIn 0.2s ease" }}>
      {/* Conteneur borné : centrage + dépassement des voisines calculés par rapport
          à cette largeur (et non à l'écran entier) → correct mobile ET desktop. */}
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div ref={scrollerRef} onScroll={onScroll}
          style={{ display: "flex", gap: 14, overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", paddingInline: `calc(50% - ${CARD_W} / 2)` }}>
          {SLIDES.map((s, n) => (
            <div key={n} style={{
              flex: `0 0 ${CARD_W}`, scrollSnapAlign: "center",
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24,
              padding: "30px 22px", boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
              display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
              minHeight: 340, justifyContent: "center",
              opacity: n === active ? 1 : 0.45, transform: `scale(${n === active ? 1 : 0.9})`,
              transition: "opacity 0.3s ease, transform 0.3s ease",
            }}>
              <span style={{ width: 78, height: 78, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(140deg, ${s.color}, ${s.color}bb)`, boxShadow: `0 10px 24px -6px ${s.color}88`, marginBottom: 22 }}>
                <Icon name={s.icon} size={36} color="#fff" />
              </span>
              <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 12px", color: "var(--text)" }}>{s.title}</h2>
              <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contrôles (sur le fond, partagés) */}
      <div style={{ width: "100%", maxWidth: 380, padding: "0 20px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 7 }}>
          {SLIDES.map((_, n) => (
            <button key={n} onClick={() => goTo(n)} aria-label={`Aller à l'étape ${n + 1}`}
              style={{ width: n === active ? 22 : 7, height: 7, borderRadius: 999, border: "none", padding: 0, cursor: "pointer", background: n === active ? "var(--accent)" : "rgba(255,255,255,0.3)", transition: "width 0.25s ease, background 0.25s ease" }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={finish} style={{ flexShrink: 0, minWidth: 60, padding: "12px 8px", background: "none", border: "none", color: "rgba(255,255,255,0.7)", fontFamily: "var(--ff-body)", fontSize: 13.5, fontWeight: 500, cursor: "pointer", visibility: last ? "hidden" : "visible" }}>
            Passer
          </button>
          <button className="btn btn-primary" onClick={next} style={{ flex: 1, borderRadius: 14, padding: "13px 0" }}>
            {last ? "C'est parti 🍳" : "Suivant"}
            {!last && <Icon name="forward" size={15} color="#fff" />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
