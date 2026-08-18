import { EmptyArt } from "../components/EmptyArt.jsx";

// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
export function LoadingPage({ isDark }) {
  return (
    <div className={`loading-root${isDark ? "" : " light"}`}>
      <div className="loading-card">
        <div className="loading-logo">Mijoté<span>·</span></div>
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
