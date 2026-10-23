import { LogoPod } from "../components/ui/LogoPod.jsx";

// Coquille « app » (mobile installé / Capacitor) : le splash d'ouverture (gousse
// qui pulse, cf. #boot-splash dans index.html) n'est peint que là. On lit le même
// drapeau que celui qui le déclenche, posé très tôt dans le <head>.
const APP_SHELL = typeof document !== "undefined"
  && document.documentElement.classList.contains("app-shell");

interface LoadingPageProps {
  isDark?: boolean;
}

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
export function LoadingPage({ isDark }: LoadingPageProps) {
  // Sur la coquille app, on PROLONGE le splash d'ouverture (même gousse qui pulse)
  // plutôt que d'introduire un SECOND système de chargement (marmite + label) : un
  // seul indicateur perçu, continu du boot jusqu'à l'app. Sur web / desktop, pas de
  // splash d'ouverture : la gousse du logo en grand, qui se dessine.
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
      <div className="loading-card" role="status" aria-label="Connexion en cours">
        <LogoPod size={120} className="loading-mark" />
        <div className="loading-word" aria-hidden="true">Cardam<span>o</span>me<span>·</span></div>
        <div className="loading-line" aria-hidden="true" />
      </div>
    </div>
  );
}
