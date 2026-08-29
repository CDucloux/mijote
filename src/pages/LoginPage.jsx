import { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "../components/Icon.jsx";
import { EmptyArt } from "../components/EmptyArt.jsx";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { LogoPod } from "../components/LogoPod.jsx";
import { getRuntimeContext, showsDiscoverLink } from "../lib/ui/runtimeContext.js";
import { signInFeedback, SIGN_IN_LOADING_MESSAGE } from "../lib/firebase/signInFeedback.js";
import { useElasticScroll } from "../hooks/useElasticScroll.js";

// Logo Google multicolore (SVG inline, pas d'asset externe).
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-3.59-13.46-8.72l-7.97 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

// En-tête de document propre à l'écran de connexion : titre, robots (hors index) et
// description dédiés, restaurés au démontage pour ne pas contaminer landing/app.
function useLoginDocumentHead() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "Connexion à Cardamome";

    let robots = document.querySelector('meta[name="robots"]');
    const robotsCreated = !robots;
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    const prevRobots = robots.getAttribute("content");
    robots.setAttribute("content", "noindex, follow");

    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") ?? null;
    desc?.setAttribute(
      "content",
      "Connecte-toi à Cardamome pour retrouver ton atelier de recettes : import, itérations, planning et courses.",
    );

    return () => {
      document.title = prevTitle;
      if (robotsCreated) robots.remove();
      else if (prevRobots !== null) robots.setAttribute("content", prevRobots);
      if (desc && prevDesc !== null) desc.setAttribute("content", prevDesc);
    };
  }, []);
}

/**
 * Écran de connexion. Deux panneaux (pitch marketing + zone d'auth) sur desktop,
 * colonne compacte sur mobile. Ne touche jamais au SDK : la connexion passe par la
 * prop `onSignIn` (service commun) qui renvoie une issue discriminée, traduite en
 * message par `signInFeedback`.
 */
export function LoginPage({ isDark, onToggleTheme, onSignIn }) {
  const [status, setStatus] = useState("idle"); // idle | loading
  const [feedback, setFeedback] = useState(null); // { tone, message } | null
  const busyRef = useRef(false);
  const ctx = useMemo(() => getRuntimeContext(), []);
  const loading = status === "loading";
  // Overscroll élastique au bas de l'écran, comme les pages de l'app ; inutile sur
  // desktop (pas de tactile, contenu qui tient).
  const isDesktop = useMemo(() => typeof matchMedia === "function" && matchMedia("(min-width: 860px)").matches, []);
  // L'écran de connexion tient à l'écran (rien à défiler) : on arme quand même
  // l'élastique sur un swipe vers le haut, sinon le geste ne produirait aucun ressenti.
  const { scrollRef, contentRef } = useElasticScroll({ disabled: isDesktop, armWhenUnscrollable: true });

  useLoginDocumentHead();

  const handleSignIn = async () => {
    if (busyRef.current) return; // anti double-clic
    busyRef.current = true;
    setStatus("loading");
    setFeedback(null);

    let outcome;
    try { outcome = await onSignIn?.(); }
    catch { outcome = { status: "error", reason: "generic" }; }
    if (!outcome) outcome = { status: "error", reason: "generic" };

    const fb = signInFeedback(outcome);
    // Succès / redirection : la page va basculer (écouteur d'auth, ou navigation
    // plein écran). On laisse le bouton désarmé plutôt que de le réactiver un instant.
    if (outcome.status === "success" || outcome.status === "redirect") {
      if (fb) setFeedback(fb);
      return;
    }
    busyRef.current = false;
    setStatus("idle");
    setFeedback(fb);
  };

  return (
    <div className={`auth${isDark ? "" : " auth--light"}`} data-context={ctx} ref={scrollRef}>
      <ThemeToggle isDark={isDark} onToggle={onToggleTheme} className="auth__theme" />

      {/* Retour vers la vitrine : uniquement dans un navigateur (jamais en PWA /
          Capacitor, ou la landing n'est pas un ecran interne), et masqué sur mobile
          (le logo prend sa place en haut). Hors de la grille pour ne pas être étiré
          par l'overscroll. */}
      {showsDiscoverLink(ctx) && (
        <a className="auth__back" href="/">
          <Icon name="back" size={16} /> Retourner à la page de présentation
        </a>
      )}

      {/* Grille scrollable (contenu étirable par l'overscroll élastique). */}
      <div className="auth__grid" ref={contentRef}>
      {/* Panneau pitch : porte l'unique h1 de la page. */}
      <section className="auth__pitch">
        <div className="auth__pitch-inner">
          <span className="auth__brand">
            <LogoPod size={26} />
            <span className="auth__wordmark">Cardam<span className="auth__brand-dot">o</span>me<span className="auth__brand-dot">·</span></span>
          </span>
          <p className="auth__eyebrow">Donne du caractère à tes recettes</p>
          <h1 className="auth__title">
            <span className="auth__only-desktop">Pas un nouveau catalogue. Ton atelier.</span>
            <span className="auth__only-mobile">Donne du caractère à tes recettes</span>
          </h1>
          <p className="auth__desc">
            <span className="auth__only-desktop">Importe les recettes que tu aimes, améliore-les à chaque essai et retrouve-les prêtes à cuisiner.</span>
          </p>
          <div className="auth__art" aria-hidden="true">
            <EmptyArt name="casserole" size={168} />
          </div>
        </div>
      </section>

      {/* Panneau d'authentification. */}
      <section className="auth__panel">
        <div className="auth__form">
          <h2 className="auth__form-title">Entre dans Cardamome.</h2>
          <p className="auth__form-sub">Connecte-toi pour retrouver ton atelier, ou crée gratuitement ton compte.</p>

          <button
            type="button"
            className="auth__google ripple"
            onClick={handleSignIn}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? <span className="auth__spinner" aria-hidden="true" /> : <GoogleMark />}
            <span>{loading ? SIGN_IN_LOADING_MESSAGE : "Continuer avec Google"}</span>
          </button>

          {feedback && (
            <p className={`auth__feedback auth__feedback--${feedback.tone}`} role={feedback.tone === "error" ? "alert" : "status"}>
              {feedback.message}
            </p>
          )}

          <p className="auth__consent">
            En continuant, tu acceptes les{" "}
            <a href="/legal/terms" target="_blank" rel="noopener noreferrer">CGU</a>
            {" "}et la{" "}
            <a href="/legal/privacy" target="_blank" rel="noopener noreferrer">Politique de confidentialité</a>.
          </p>
        </div>
        <p className="auth__legalline">© 2026 Cardamome · v{__APP_VERSION__}</p>
      </section>
      </div>
    </div>
  );
}
