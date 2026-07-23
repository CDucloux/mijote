import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── ONBOARDING – CARROUSEL DE BIENVENUE ──────────────────────────────────────
// Affiché une seule fois à la première connexion (flag localStorage par uid).
// Piste de cards pilotée par `active` : la variable CSS --onb-active positionne
// la carte active au centre de la fenêtre (transform déterministe). Toute la
// géométrie et le responsive vivent dans global.css (.onb-*). Portalisé <body>.
const seenKey = (uid) => `mijote_onboarded_${uid}`;

const SLIDES = [
  {
    icon: "sparkle", color: "#e8703a",
    title: "Bienvenue sur Mijoté",
    text: <>Bien plus qu'un carnet de recettes : une vraie base d'<em>ingrédients</em>, d'<em>ustensiles</em> et de <em>techniques</em> pour <strong>comprendre ce que tu cuisines</strong>, et progresser à chaque plat.</>,
  },
  {
    icon: "list2", color: "#e8703a",
    title: "Cuisine guidée, pas à pas",
    text: <>Lance le <strong>mode pas à pas</strong> et avance sereinement. Chaque <em>geste technique</em> s'explique au bon moment, pour réussir même ce que tu n'as jamais tenté.</>,
  },
  {
    icon: "leaf", color: "#4caf7d",
    title: "Difficulté, saison, Nutri-Score",
    text: <>Mijoté lit tes recettes et fait le calcul : <strong>difficulté</strong> déduite des techniques, <em>saisonnalité</em> des ingrédients et <em>Nutri-Score</em>, sans rien à saisir.</>,
  },
  {
    icon: "calendar", color: "#5b9cf6",
    title: "Planifie ta semaine",
    text: <>Glisse tes recettes sur le planning, <strong>midi et soir</strong>. Un tap suffit pour tout exporter vers ton agenda, le reste se remplit tout seul.</>,
  },
  {
    icon: "shopping", color: "#e8703a",
    title: "Courses et stock, synchronisés",
    text: <>Ta <strong>liste de courses</strong> se génère depuis ton planning et se coche à mesure. En face, ton <strong>stock</strong> se met à jour ingrédient par ingrédient.</>,
  },
  {
    icon: "globe", color: "#c080e0",
    title: "Explore et partage",
    text: <>Parcours les recettes de la communauté, filtre par <em>saison</em>, <em>type de cuisine</em> ou <em>Nutri-Score</em>, et publie les tiennes quand tu es prêt·e.</>,
  },
  {
    icon: "home", color: "#e8703a",
    title: "Cuisinez à plusieurs",
    text: <>Crée un <strong>foyer</strong> et partagez recettes, planning, courses et stock <em>en temps réel</em>. À vous de jouer !</>,
  },
];

export function OnboardingCarousel() {
  const { user } = useAppShell();
  const [show, setShow] = useState(false);
  const [active, setActive] = useState(0);
  const [closing, setClosing] = useState(false);
  const touchX = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    let seen = false;
    try { seen = localStorage.getItem(seenKey(user.uid)) === "1"; } catch { /* ignore */ }
    if (!seen) setShow(true);
  }, [user]);

  useEffect(() => {
    const replay = () => { setClosing(false); setActive(0); setShow(true); };
    window.addEventListener("mijote:show-onboarding", replay);
    return () => window.removeEventListener("mijote:show-onboarding", replay);
  }, []);

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  const finish = () => {
    if (closing) return;
    try { if (user?.uid) localStorage.setItem(seenKey(user.uid), "1"); } catch { /* ignore */ }
    // Fermeture douce : on laisse jouer l'animation de sortie avant de démonter.
    setClosing(true);
    closeTimer.current = setTimeout(() => { setShow(false); setClosing(false); }, 300);
  };
  const goTo = (n) => setActive(Math.max(0, Math.min(SLIDES.length - 1, n)));
  const next = () => (active < SLIDES.length - 1 ? setActive(active + 1) : finish());

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -45) goTo(active + 1);
    else if (dx > 45) goTo(active - 1);
    touchX.current = null;
  };

  if (!show) return null;
  const last = active === SLIDES.length - 1;
  const N = SLIDES.length;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, overflow: "hidden",
      background: SLIDES[active].color, transition: "background 0.4s ease, opacity 0.3s",
      opacity: closing ? 0 : 1 }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* Passer (sauf dernière slide) */}
      {!last && (
        <button onClick={finish} style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top))", right: 18, zIndex: 3, background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: 6 }}>Passer</button>
      )}

      {/* Piste plein écran : une slide occupe toute la fenêtre */}
      <div style={{ display: "flex", height: "100%", width: `${N * 100}%`, transform: `translateX(-${active * (100 / N)}%)`, transition: "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
        {SLIDES.map((s, n) => (
          <div key={n} style={{ width: `${100 / N}%`, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
            <div style={{ width: 168, height: 168, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", marginBottom: 40, boxShadow: "0 18px 50px -20px rgba(0,0,0,0.45)" }}>
              <Icon name={s.icon} size={74} color={s.color} />
            </div>
            <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 16px" }}>{s.title}</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "rgba(255,255,255,0.92)", margin: 0, maxWidth: 440 }}>{s.text}</p>
          </div>
        ))}
      </div>

      {/* Bas : indice/CTA + pastilles */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(30px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", alignItems: "center", gap: 22, padding: "0 32px" }}>
        {last
          ? <button onClick={finish} style={{ background: "#fff", color: SLIDES[active].color, border: "none", borderRadius: 16, padding: "15px 44px", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 30px -12px rgba(0,0,0,0.4)" }}>C'est parti !</button>
          : <button onClick={next} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Glisse pour continuer <Icon name="forward" size={15} color="rgba(255,255,255,0.9)" /></button>}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {SLIDES.map((_, n) => (
            <button key={n} onClick={() => goTo(n)} aria-label={`Étape ${n + 1}`}
              style={{ width: n === active ? 22 : 8, height: 8, borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
                background: n === active ? "#fff" : "rgba(255,255,255,0.45)", transition: "width 0.3s ease, background 0.3s ease" }} />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
