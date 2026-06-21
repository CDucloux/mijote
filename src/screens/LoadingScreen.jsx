// ─── LOADING SCREEN ───────────────────────────────────────────────────────────
export function LoadingScreen({ isDark }) {
  return (
    <div className={`loading-root${isDark ? "" : " light"}`}>
      <div className="loading-blob" style={{ width: 320, height: 320, background: "var(--accent)", top: "-60px", right: "-60px" }} />
      <div className="loading-blob" style={{ width: 240, height: 240, background: "#5b9cf6", bottom: "60px", left: "-50px" }} />
      <div className="loading-card">
        <div className="loading-logo">Mijoté<span>·</span></div>
        <div className="loading-spinner-wrap">
          <div className="loading-spinner-track" />
          <div className="loading-spinner" />
          <div className="loading-emoji">🫕</div>
        </div>
        <div className="loading-label">Connexion en cours…</div>
      </div>
    </div>
  );
}
