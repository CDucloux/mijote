import { EmptyArt } from "../components/EmptyArt.jsx";

// Coquille « app » (mobile installé / Capacitor) : le splash d'ouverture (gousse
// qui pulse, cf. #boot-splash dans index.html) n'est peint que là. On lit le même
// drapeau que celui qui le déclenche, posé très tôt dans le <head>.
const APP_SHELL = typeof document !== "undefined"
  && document.documentElement.classList.contains("app-shell");

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
export function LoadingPage({ isDark }) {
  // Sur la coquille app, on PROLONGE le splash d'ouverture (même gousse qui pulse)
  // plutôt que d'introduire un SECOND système de chargement (marmite + label) : un
  // seul indicateur perçu, continu du boot jusqu'à l'app. Sur web / desktop, pas de
  // splash d'ouverture, donc on garde l'écran de chargement complet.
  if (APP_SHELL) {
    return (
      <div className={`loading-root loading-root--boot${isDark ? "" : " light"}`}>
        <div className="loading-pod" role="img" aria-label="Chargement">
          <span className="loading-pod__pulse" />
          <span className="loading-pod__pulse delay" />
          <img className="loading-pod__logo" src="/pwa-512.png" width="116" height="116" alt="" />
        </div>
      </div>
    );
  }
  return (
    <div className={`loading-root${isDark ? "" : " light"}`}>
      <div className="loading-card">
        <div className="loading-logo">Cardam<span className="oh">o</span>me<span>·</span></div>
        <div className="loading-spinner-wrap">
          <div className="loading-spinner-track" />
          <div className="loading-spinner" />
          <div className="loading-art"><EmptyArt name="casserole" size={44} /></div>
        </div>
        <div className="loading-label">Connexion en cours…</div>
      </div>
    </div>
  );
}
