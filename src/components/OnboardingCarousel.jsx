import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── ONBOARDING – CARROUSEL DE BIENVENUE ──────────────────────────────────────
// Affiché une seule fois à la première connexion (flag localStorage par uid).
// Piste de cards pilotée par `active` (transform translateX déterministe) : la
// carte active est centrée, les voisines dépassent d'un montant fixe (peek) et
// sont mises en retrait (opacité + léger scale). Portalisé dans <body>.
const seenKey = (uid) => `mijote_onboarded_${uid}`;

// Géométrie responsive : les cartes sont nettement plus grandes sur desktop.
const geo = (desktop) =>
  desktop
    ? { CARD: "min(88vw, 440px)", GAP: 18, PEEK: 34, minHeight: 430, pad: "44px 40px", icon: 46, iconBox: 96, title: 27, text: 16 }
    : { CARD: "min(82vw, 320px)", GAP: 14, PEEK: 24, minHeight: 372, pad: "34px 26px", icon: 38, iconBox: 80, title: 22, text: 14.5 };

const SLIDES = [
  {
    icon: "sparkle", color: "#e8703a",
    title: "Bienvenue dans Mijoté",
    text: "Pas une app de recettes de plus. Une vraie base d'ingrédients, d'ustensiles et de techniques pour comprendre ce que tu cuisines — et progresser à chaque plat.",
  },
  {
    icon: "book", color: "#e8703a",
    title: "Chaque recette, décortiquée",
    text: "Derrière un plat, il y a ses ingrédients, ses ustensiles et des gestes techniques expliqués un à un. Ici, tu ne suis pas une recette : tu apprends à la faire.",
  },
  {
    icon: "leaf", color: "#4caf7d",
    title: "Difficulté, saison, Nutri-Score",
    text: "Mijoté lit tes recettes et fait le calcul : indice de difficulté déduit des techniques, saisonnalité des ingrédients et Nutri-Score, sans que tu aies rien à saisir.",
  },
  {
    icon: "calendar", color: "#5b9cf6",
    title: "Planifie ta semaine",
    text: "Glisse tes recettes sur le planning, midi et soir. Un tap suffit pour tout exporter vers ton agenda — le reste se remplit tout seul.",
  },
  {
    icon: "shopping", color: "#e8703a",
    title: "Courses et stock, synchronisés",
    text: "Ta liste de courses se génère depuis ton planning et se coche à mesure. En face, ton stock se met à jour ingrédient par ingrédient.",
  },
  {
    icon: "globe", color: "#c080e0",
    title: "Explore et partage",
    text: "Parcours les recettes de la communauté, filtre par saison, type de cuisine ou Nutri-Score, et publie les tiennes quand tu es prêt·e.",
  },
  {
    icon: "home", color: "#e8703a",
    title: "Cuisinez à plusieurs",
    text: "Crée un foyer et partagez recettes, planning, courses et stock en temps réel. À vous de jouer !",
  },
];

export function OnboardingCarousel() {
  const { user } = useAppShell();
  const [show, setShow] = useState(false);
  const [active, setActive] = useState(0);
  const [desktop, setDesktop] = useState(false);
  const touchX = useRef(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    let seen = false;
    try { seen = localStorage.getItem(seenKey(user.uid)) === "1"; } catch { /* ignore */ }
    if (!seen) setShow(true);
  }, [user]);

  useEffect(() => {
    const replay = () => { setActive(0); setShow(true); };
    window.addEventListener("mijote:show-onboarding", replay);
    return () => window.removeEventListener("mijote:show-onboarding", replay);
  }, []);

  const finish = () => {
    try { if (user?.uid) localStorage.setItem(seenKey(user.uid), "1"); } catch { /* ignore */ }
    setShow(false);
  };
  const goTo = (n) => setActive(Math.max(0, Math.min(SLIDES.length - 1, n)));
  const next = () => (active < SLIDES.length - 1 ? setActive(active + 1) : finish());
  const prev = () => goTo(active - 1);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -45) goTo(active + 1);
    else if (dx > 45) goTo(active - 1);
    touchX.current = null;
  };

  if (!show) return null;
  const g = geo(desktop);
  const VIEWPORT = `calc(${g.CARD} + ${2 * (g.GAP + g.PEEK)}px)`;
  const LEAD = g.GAP + g.PEEK;
  const first = active === 0;
  const last = active === SLIDES.length - 1;
  const shift = `translateX(calc(${LEAD}px - ${active} * (${g.CARD} + ${g.GAP}px)))`;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: desktop ? 30 : 22, padding: "20px 0", animation: "fadeIn 0.2s ease" }}>
      {/* Fenêtre (clippe les voisines pour ne montrer que le peek) */}
      <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} style={{ width: VIEWPORT, maxWidth: "96vw", overflow: "hidden", padding: "18px 0" }}>
        <div style={{ display: "flex", gap: g.GAP, transform: shift, transition: "transform 0.42s cubic-bezier(0.22,1,0.36,1)" }}>
          {SLIDES.map((s, n) => {
            const on = n === active;
            return (
              <div key={n} style={{
                flex: `0 0 ${g.CARD}`, boxSizing: "border-box",
                background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 26,
                padding: g.pad,
                boxShadow: on
                  ? `0 26px 60px -28px ${s.color}66, 0 14px 40px -20px rgba(0,0,0,0.35)`
                  : "0 8px 24px -18px rgba(0,0,0,0.3)",
                display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
                minHeight: g.minHeight, justifyContent: "center",
                opacity: on ? 1 : 0.42,
                transform: on ? "scale(1)" : "scale(0.92)",
                transformOrigin: "center",
                transition: "opacity 0.4s ease, transform 0.4s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s ease",
              }}>
                <span style={{ width: g.iconBox, height: g.iconBox, borderRadius: 24, display: "flex", alignItems: "center", justifyContent: "center", background: `linear-gradient(140deg, ${s.color}, ${s.color}bb)`, boxShadow: `0 12px 28px -8px ${s.color}88`, marginBottom: desktop ? 28 : 22 }}>
                  <Icon name={s.icon} size={g.icon} color="#fff" />
                </span>
                <h2 style={{ fontFamily: "var(--ff-display)", fontSize: g.title, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.15, margin: `0 0 ${desktop ? 16 : 12}px`, color: "var(--text)" }}>{s.title}</h2>
                <p style={{ fontSize: g.text, color: "var(--text2)", lineHeight: 1.62, margin: 0, maxWidth: desktop ? 360 : "none" }}>{s.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contrôles */}
      <div style={{ width: "100%", maxWidth: desktop ? 460 : 360, padding: "0 20px", display: "flex", flexDirection: "column", gap: desktop ? 24 : 18 }}>
        {/* Indicateur de progression segmenté */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
          {SLIDES.map((_, n) => {
            const on = n === active;
            const done = n < active;
            return (
              <button key={n} onClick={() => goTo(n)} aria-label={`Aller à l'étape ${n + 1}`}
                style={{
                  width: on ? 28 : 8, height: 8, borderRadius: 999, border: "none", padding: 0, cursor: "pointer",
                  background: on
                    ? "linear-gradient(90deg, var(--accent), var(--accent2))"
                    : done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.22)",
                  boxShadow: on ? "0 2px 10px -2px var(--accent)" : "none",
                  transition: "width 0.3s cubic-bezier(0.22,1,0.36,1), background 0.3s ease",
                }} />
            );
          })}
        </div>
        {/* Boutons : à gauche Passer (1re carte) ou Précédent, à droite Suivant */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={first ? finish : prev}
            style={{ flexShrink: 0, minWidth: first ? 68 : 118, padding: "13px 16px", borderRadius: 14, background: first ? "none" : "rgba(255,255,255,0.1)", border: first ? "none" : "1px solid rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.82)", fontFamily: "var(--ff-body)", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "background 0.2s ease" }}>
            {!first && <Icon name="back" size={15} color="rgba(255,255,255,0.82)" />}
            {first ? "Passer" : "Précédent"}
          </button>
          <button className="btn btn-primary" onClick={next} style={{ flex: 1, borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 600 }}>
            {last ? "C'est parti 🍳" : "Suivant"}
            {!last && <Icon name="forward" size={15} color="#fff" />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
