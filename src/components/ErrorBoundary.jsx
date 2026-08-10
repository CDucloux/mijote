import React from "react";
import { reportError } from "../lib/observability/observability.js";

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
// Filet de sécurité global : un throw au render ne doit pas laisser un écran
// blanc (surtout en PWA / hors-ligne). On affiche un repli sobre avec recharge.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Remonte via la couture d'observabilité (console en dev, Sentry en prod).
    reportError(error, { where: "ErrorBoundary", componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 14,
        padding: 32, textAlign: "center", background: "var(--bg, #1a1714)", color: "var(--text, #f2efe9)",
        fontFamily: "system-ui, sans-serif",
      }}>
        <div style={{ fontSize: 40, lineHeight: 1 }}>🍲</div>
        <h1 style={{ fontFamily: "Georgia, serif", fontSize: 22, fontWeight: 600, margin: 0 }}>Oups, un grain de sel…</h1>
        <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 320, lineHeight: 1.5, margin: 0 }}>
          Une erreur inattendue est survenue. Tes données sont en sécurité – recharge l'application pour continuer.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 6, padding: "11px 22px", borderRadius: 12, border: "none", cursor: "pointer", background: "#e8703a", color: "#fff", fontSize: 14, fontWeight: 600 }}>
          Recharger
        </button>
      </div>
    );
  }
}
