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

// ── Illustrations SVG maison (test de style, 2 slides sur 7) ──────────────────
const IL = { width: 116, height: 116, viewBox: "0 0 120 120", fill: "none" };
function PotIllustration() {
  return (
    <svg {...IL}>
      {/* vapeur */}
      <path d="M50 30 C44 24 44 18 50 12" stroke="#f0a875" strokeWidth="4" strokeLinecap="round" />
      <path d="M62 31 C56 23 56 16 62 8" stroke="#f0a875" strokeWidth="4" strokeLinecap="round" />
      <path d="M74 30 C68 24 68 18 74 12" stroke="#f0a875" strokeWidth="4" strokeLinecap="round" />
      {/* anses */}
      <ellipse cx="25" cy="67" rx="8" ry="10" stroke="#c85a2a" strokeWidth="6" />
      <ellipse cx="95" cy="67" rx="8" ry="10" stroke="#c85a2a" strokeWidth="6" />
      {/* corps */}
      <path d="M28 55 H92 L87 92 C86.5 96 83 98 79 98 H41 C37 98 33.5 96 33 92 Z" fill="#e8703a" />
      <path d="M42 63 C41 74 41 82 45 90" stroke="rgba(255,255,255,0.4)" strokeWidth="5" strokeLinecap="round" />
      {/* couvercle */}
      <rect x="24" y="47" width="72" height="12" rx="6" fill="#f0a875" />
      <rect x="53" y="39" width="14" height="10" rx="4" fill="#c85a2a" />
    </svg>
  );
}
function PlanningIllustration() {
  return (
    <svg {...IL}>
      {/* reliure */}
      <rect x="40" y="24" width="7" height="20" rx="3.5" fill="#3f6fb0" />
      <rect x="73" y="24" width="7" height="20" rx="3.5" fill="#3f6fb0" />
      {/* corps */}
      <rect x="24" y="34" width="72" height="62" rx="11" fill="#eaf1fb" stroke="#cdddf2" strokeWidth="2" />
      {/* bandeau */}
      <path d="M24 46 C24 39.4 29.4 34 36 34 H84 C90.6 34 96 39.4 96 46 V52 H24 Z" fill="#5b9cf6" />
      {/* jours */}
      <circle cx="40" cy="66" r="4" fill="#c9d8ee" />
      <circle cx="60" cy="66" r="4" fill="#c9d8ee" />
      <circle cx="80" cy="66" r="4" fill="#c9d8ee" />
      {/* coche */}
      <path d="M41 81 L53 91 L81 65" stroke="#4caf7d" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ToqueIllustration() {
  return (
    <svg {...IL}>
      {/* contour gris clair (effet sticker, pour voir le blanc sur fond blanc) */}
      <g fill="#d7dde3">
        <circle cx="44" cy="52" r="18" />
        <circle cx="60" cy="45" r="20" />
        <circle cx="76" cy="52" r="18" />
        <rect x="30" y="52" width="60" height="23" rx="4" />
        <rect x="33" y="73" width="54" height="20" rx="7" />
      </g>
      {/* toque blanche */}
      <g fill="#ffffff">
        <circle cx="44" cy="52" r="15.5" />
        <circle cx="60" cy="45" r="17.5" />
        <circle cx="76" cy="52" r="15.5" />
        <rect x="33" y="52" width="54" height="23" rx="3" />
        <rect x="35.5" y="75.5" width="49" height="15.5" rx="5.5" />
      </g>
      {/* plis du bandeau + ombre douce sous la coiffe */}
      <path d="M37 78 H83" stroke="#eef1f4" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M48 79 V89 M60 79 V89 M72 79 V89" stroke="#e7ebef" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function LeafIllustration() {
  return (
    <svg {...IL}>
      <path d="M58 26 C33 39 29 74 44 95 C71 93 94 61 84 32 C71 41 62 39 58 26 Z" fill="#4caf7d" />
      <path d="M58 26 C33 39 29 74 44 95 C50 80 52 58 84 32 C71 41 62 39 58 26 Z" fill="#6fce9b" />
      <path d="M49 90 C55 66 66 50 82 41" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}
function BasketIllustration() {
  return (
    <svg {...IL}>
      {/* anse */}
      <path d="M42 54 Q60 30 78 54" stroke="#c85a2a" strokeWidth="5" fill="none" strokeLinecap="round" />
      {/* baguette */}
      <g transform="rotate(-16 52 40)">
        <rect x="47" y="24" width="9" height="32" rx="4.5" fill="#dda15e" />
        <path d="M50 30 l3 -2 M50 37 l3 -2 M50 44 l3 -2" stroke="#b9773c" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {/* botte de verdure */}
      <path d="M64 54 C60 36 66 26 70 26 C72 32 75 32 77 27 C81 32 81 46 76 54 Z" fill="#4caf7d" />
      <path d="M70 54 C70 42 72 34 74 30" stroke="#3f9e6d" strokeWidth="2" strokeLinecap="round" />
      {/* carotte */}
      <path d="M60 56 L53 32 L67 50 Z" fill="#f0902a" />
      <path d="M53 32 l-4 -6 M55 31 l0 -7 M57 32 l4 -6" stroke="#4caf7d" strokeWidth="2.4" strokeLinecap="round" />
      {/* panier */}
      <path d="M30 52 H90 L84 88 C83.6 92 80 94 76 94 H44 C40 94 36.4 92 36 88 Z" fill="#e8703a" />
      <rect x="27" y="50" width="66" height="9" rx="4.5" fill="#f0a875" />
      <path d="M45 62 V90 M57 62 V92 M69 62 V92 M81 62 V90" stroke="rgba(255,255,255,0.22)" strokeWidth="3" />
      <path d="M39 70 H82 M41 82 H80" stroke="rgba(255,255,255,0.22)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function GlobeIllustration() {
  return (
    <svg {...IL}>
      <circle cx="60" cy="60" r="34" fill="#c080e0" />
      <path d="M44 44 C52 50 52 70 44 78 M76 44 C68 50 68 70 76 78" stroke="#9b4fc0" strokeWidth="4" fill="none" />
      <path d="M46 40 C40 62 44 82 46 82 M74 40 C80 62 76 82 74 82" fill="#a860c8" opacity="0.5" />
      <line x1="26" y1="60" x2="94" y2="60" stroke="rgba(255,255,255,0.55)" strokeWidth="3" />
      <path d="M30 46 H90 M30 74 H90" stroke="rgba(255,255,255,0.4)" strokeWidth="3" />
      <ellipse cx="60" cy="60" rx="15" ry="34" stroke="rgba(255,255,255,0.55)" strokeWidth="3" fill="none" />
    </svg>
  );
}
function HouseIllustration() {
  return (
    <svg {...IL}>
      <rect x="74" y="40" width="8" height="16" fill="#c85a2a" />
      <path d="M28 62 L60 32 L92 62 Z" fill="#e8703a" />
      <rect x="38" y="58" width="44" height="38" rx="4" fill="#f4a663" />
      <path d="M60 84 C53 78 47 74 47 67.5 C47 63.5 50 61 53.5 61 C56.5 61 59 63.5 60 65 C61 63.5 63.5 61 66.5 61 C70 61 73 63.5 73 67.5 C73 74 67 78 60 84 Z" fill="#e8703a" />
    </svg>
  );
}

const SLIDES = [
  {
    illustration: PotIllustration, color: "#e8703a",
    title: "Bienvenue sur Mijoté",
    text: <>Bien plus qu'un carnet de recettes : une vraie base d'<em>ingrédients</em>, d'<em>ustensiles</em> et de <em>techniques</em> pour <strong>comprendre ce que tu cuisines</strong>, et progresser à chaque plat.</>,
  },
  {
    illustration: ToqueIllustration, color: "#e8703a",
    title: "Cuisine guidée, pas à pas",
    text: <>Lance le <strong>mode pas à pas</strong> et avance sereinement. Chaque <em>geste technique</em> s'explique au bon moment, pour réussir même ce que tu n'as jamais tenté.</>,
  },
  {
    illustration: LeafIllustration, color: "#4caf7d",
    title: "Difficulté, saison, Nutri-Score",
    text: <>Mijoté lit tes recettes et fait le calcul : <strong>difficulté</strong> déduite des techniques, <em>saisonnalité</em> des ingrédients et <em>Nutri-Score</em>, sans rien à saisir.</>,
  },
  {
    illustration: PlanningIllustration, color: "#5b9cf6",
    title: "Ta semaine se planifie toute seule",
    text: <>Génère une semaine complète en un tap : Mijoté compose des <strong>repas équilibrés</strong> (entrée, plat, accompagnement, dessert), privilégie la <em>saison</em>, varie les plaisirs et <strong>réutilise les portions cuisinées</strong> pour t'éviter de tout refaire. Une <em>session batch</em> te dit quoi préparer d'avance, et tout s'exporte vers ton agenda.</>,
  },
  {
    illustration: BasketIllustration, color: "#e8703a",
    title: "Courses et stock, synchronisés",
    text: <>Ta <strong>liste de courses</strong> se génère depuis ton planning et se coche à mesure. En face, ton <strong>stock</strong> se met à jour ingrédient par ingrédient.</>,
  },
  {
    illustration: GlobeIllustration, color: "#c080e0",
    title: "Explore et partage",
    text: <>Parcours les recettes de la communauté, filtre par <em>saison</em>, <em>type de cuisine</em> ou <em>Nutri-Score</em>, et publie les tiennes quand tu es prêt·e.</>,
  },
  {
    illustration: HouseIllustration, color: "#e8703a",
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

  // Navigation clavier (desktop) : flèches gauche/droite.
  useEffect(() => {
    if (!show) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") setActive(a => Math.min(SLIDES.length - 1, a + 1));
      else if (e.key === "ArrowLeft") setActive(a => Math.max(0, a - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

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
      background: `radial-gradient(125% 80% at 50% 16%, rgba(255,255,255,0.16), transparent 55%), ${SLIDES[active].color}`,
      transition: "background 0.4s ease, opacity 0.3s", opacity: closing ? 0 : 1 }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* Passer (sauf dernière slide) */}
      {!last && (
        <button onClick={finish} style={{ position: "absolute", top: "calc(14px + env(safe-area-inset-top))", right: 18, zIndex: 3, background: "none", border: "none", color: "rgba(255,255,255,0.85)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: 6 }}>Passer</button>
      )}

      {/* Piste plein écran : une slide occupe toute la fenêtre */}
      <div style={{ display: "flex", height: "100%", width: `${N * 100}%`, transform: `translateX(-${active * (100 / N)}%)`, transition: "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)" }}>
        {SLIDES.map((s, n) => (
          <div key={n} style={{ width: `${100 / N}%`, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center" }}>
            {/* Clé liée à `active` : l'animation d'entrée rejoue à chaque slide affichée */}
            <div key={n === active ? `on-${active}` : `off-${n}`} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 164, height: 164, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center", marginBottom: 44, boxShadow: "0 0 0 12px rgba(255,255,255,0.16), 0 16px 44px -18px rgba(0,0,0,0.4)", animation: n === active ? "onbPop 0.5s ease-out both" : "none" }}>
                {s.illustration
                  ? <s.illustration />
                  : <span style={{ fontSize: 78, lineHeight: 1, display: "block", transform: "translateY(3px)" }}>{s.emoji}</span>}
              </div>
              <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 30, fontWeight: 600, letterSpacing: "-0.01em", color: "#fff", margin: "0 0 16px", animation: n === active ? "onbRise 0.5s 0.12s both" : "none" }}>{s.title}</h2>
              <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "rgba(255,255,255,0.92)", margin: 0, maxWidth: 440, animation: n === active ? "onbRise 0.5s 0.2s both" : "none" }}>{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Bas : barre de progression + indice/CTA */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: "calc(30px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "0 32px" }}>
        {last
          ? <button onClick={finish} style={{ background: "#fff", color: SLIDES[active].color, border: "none", borderRadius: 16, padding: "15px 44px", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 30px -12px rgba(0,0,0,0.4)" }}>C'est parti !</button>
          : <button onClick={next} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Glisse pour continuer <Icon name="forward" size={15} color="rgba(255,255,255,0.9)" /></button>}
        {/* Progression continue */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)", fontVariantNumeric: "tabular-nums", minWidth: 30 }}>{active + 1}/{N}</span>
          <div style={{ width: 170, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.28)", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#fff", borderRadius: 999, width: `${((active + 1) / N) * 100}%`, transition: "width 0.45s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
