import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── ONBOARDING – CARROUSEL DE BIENVENUE ──────────────────────────────────────
// S'affiche une seule fois à la première connexion (flag localStorage par uid).
// Présente les piliers de Mijoté ; skippable, swipeable, portalisé dans <body>
// (hors du #root mis à l'échelle) pour couvrir tout l'écran proprement.
const seenKey = (uid) => `mijote_onboarded_${uid}`;

const SLIDES = [
  { icon: "sparkle", color: "#e8703a", title: "Bienvenue sur Mijoté", text: "Tes recettes, ton planning, tes courses et ton stock — enfin réunis au même endroit, synchronisés partout." },
  { icon: "book", color: "#e8703a", title: "Tes recettes, bien rangées", text: "Crée et organise tes recettes dans des carnets. Suis-les en pas-à-pas, avec les gestes techniques expliqués et un indice de difficulté." },
  { icon: "calendar", color: "#5b9cf6", title: "Planifie ta semaine", text: "Glisse tes recettes sur le planning des repas, midi et soir. Exporte le tout vers ton agenda en un tap." },
  { icon: "shopping", color: "#e8703a", title: "Courses & stock, automatiques", text: "Génère ta liste de courses depuis ton planning, coche au fur et à mesure, et garde un œil sur ce qu'il te reste en stock." },
  { icon: "globe", color: "#c080e0", title: "Découvre & partage", text: "Explore les recettes de la communauté, filtre par saison, cuisine ou Nutri-Score, et publie les tiennes." },
  { icon: "home", color: "#e8703a", title: "Cuisinez à plusieurs", text: "Crée un foyer : recettes, courses, planning et stock deviennent communs, en temps réel. À vous de jouer !" },
];

export function OnboardingCarousel() {
  const { user } = useAppShell();
  const [show, setShow] = useState(false);
  const [i, setI] = useState(0);
  const touchX = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    let seen = false;
    try { seen = localStorage.getItem(seenKey(user.uid)) === "1"; } catch { /* ignore */ }
    if (!seen) { setI(0); setShow(true); }
  }, [user]);

  // Rejouable à la demande (ex. menu avatar « Revoir l'introduction »).
  useEffect(() => {
    const replay = () => { setI(0); setShow(true); };
    window.addEventListener("mijote:show-onboarding", replay);
    return () => window.removeEventListener("mijote:show-onboarding", replay);
  }, []);

  const finish = () => {
    try { if (user?.uid) localStorage.setItem(seenKey(user.uid), "1"); } catch { /* ignore */ }
    setShow(false);
  };
  const next = () => (i < SLIDES.length - 1 ? setI(i + 1) : finish());
  const prev = () => setI(v => Math.max(0, v - 1));

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -45) next();
    else if (dx > 45) prev();
    touchX.current = null;
  };

  if (!show) return null;
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "fadeIn 0.2s ease" }}>
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{ width: "100%", maxWidth: 380, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: "26px 24px 20px", boxShadow: "0 24px 70px rgba(0,0,0,0.5)", animation: "modalIn 0.34s cubic-bezier(0.16,1,0.3,1)" }}>
        {/* Visuel */}
        <div key={i} className="slide-up" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <span style={{ width: 74, height: 74, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(140deg, ${s.color}, ${s.color}bb)`, boxShadow: `0 10px 24px -6px ${s.color}88`, marginBottom: 20 }}>
            <Icon name={s.icon} size={34} color="#fff" />
          </span>
          <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 23, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 10px" }}>{s.title}</h2>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6, margin: 0, minHeight: 88 }}>{s.text}</p>
        </div>

        {/* Pastilles de progression */}
        <div style={{ display: "flex", justifyContent: "center", gap: 7, margin: "22px 0 18px" }}>
          {SLIDES.map((_, n) => (
            <button key={n} onClick={() => setI(n)} aria-label={`Aller à l'étape ${n + 1}`}
              style={{ width: n === i ? 22 : 7, height: 7, borderRadius: 999, border: "none", padding: 0, cursor: "pointer", background: n === i ? "var(--accent)" : "var(--surface3)", transition: "width 0.25s ease, background 0.25s ease" }} />
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={finish} style={{ flexShrink: 0, padding: "11px 8px", background: "none", border: "none", color: "var(--text3)", fontFamily: "var(--ff-body)", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>
            {last ? "" : "Passer"}
          </button>
          <button className="btn btn-primary" onClick={next} style={{ flex: 1, borderRadius: 14, padding: "12px 0" }}>
            {last ? "C'est parti 🍳" : "Suivant"}
            {!last && <Icon name="forward" size={15} color="#fff" />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
