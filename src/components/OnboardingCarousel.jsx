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
  const first = active === 0;
  const last = active === SLIDES.length - 1;

  return createPortal(
    <div className={`onb-overlay${closing ? " is-closing" : ""}`}>
      {/* Fenêtre : clippe les voisines pour ne montrer que le peek */}
      <div className="onb-viewport" style={{ "--onb-active": active }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="onb-track">
          {SLIDES.map((s, n) => (
            <div key={n} className={`onb-card${n === active ? " is-active" : ""}`} style={{ "--c": s.color }}>
              <span className="onb-iconbox"><Icon name={s.icon} size={38} color="#fff" /></span>
              <h2 className="onb-title">{s.title}</h2>
              <p className="onb-text">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="onb-controls">
        <div className="onb-dots">
          {SLIDES.map((_, n) => (
            <button key={n} onClick={() => goTo(n)} aria-label={`Aller à l'étape ${n + 1}`}
              className={`onb-dot${n === active ? " is-active" : n < active ? " is-done" : ""}`} />
          ))}
        </div>
        <div className="onb-buttons">
          <button className={`onb-btn-sec${first ? "" : " is-prev"}`} onClick={first ? finish : prev}>
            {!first && <Icon name="back" size={15} color="rgba(255,255,255,0.82)" />}
            {first ? "Passer" : "Précédent"}
          </button>
          <button className="btn btn-primary onb-btn-primary" onClick={next}>
            {last ? "C'est parti" : "Suivant"}
            <Icon name={last ? "fire" : "forward"} size={16} color="#fff" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
