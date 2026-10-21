import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { reportError } from "../../lib/observability/observability.js";
import { CONTACT_MAILTO } from "../../constants/contact.js";
import { EmptyArt } from "./EmptyArt.jsx";
import { Icon } from "./Icon.jsx";

interface ErrorBoundaryProps {
  children?: ReactNode;
  /** Accueil de la zone courante (vitrine ou appli) : la frontière vit hors du routeur. */
  homeHref?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Filet de sécurité global : un throw au render ne doit pas laisser un écran
// blanc (surtout en PWA / hors-ligne). Le repli s'affiche SUR PLACE, sans
// redirection : l'URL reste celle de la page fautive, donc « Recharger » la
// retente telle quelle (une route d'erreur dédiée rechargerait l'erreur).
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Remonte via la couture d'observabilité (console en dev, Sentry en prod).
    reportError(error, { where: "ErrorBoundary", componentStack: info?.componentStack });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const homeHref = this.props.homeHref ?? "/";
    // Le mail de contact embarque la page et le message d'erreur : le support part
    // d'un vrai indice plutôt que d'un « ça ne marche pas ».
    const mailto = `${CONTACT_MAILTO}&body=${encodeURIComponent(`Page : ${window.location.href}\nErreur : ${error.message}\n\nCe que je faisais : `)}`;
    return (
      <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 24px", background: "var(--bg, #0f110d)", color: "var(--text, #eef1e7)", fontFamily: "var(--ff-body, system-ui, sans-serif)" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>
          <EmptyArt name="casserole" size={112} style={{ marginLeft: -10, marginBottom: 10 }} />
          <h1 style={{ fontFamily: "var(--ff-display, Georgia, serif)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0 }}>Oups, un grain de sel dans la recette</h1>
          <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.6, margin: "12px 0 0", maxWidth: "52ch" }}>
            Quelque chose a accroché de notre côté. Tes recettes et tes listes sont en sécurité : recharge la page pour reprendre où tu en étais.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 26 }}>
            <button className="btn btn-primary btn-pill btn-flat" style={{ padding: "12px 24px", fontSize: 14.5, fontWeight: 600 }} onClick={() => window.location.reload()}>
              <Icon name="refresh" size={16} color="currentColor" /> Recharger
            </button>
            <a className="btn btn-ghost btn-pill" href={homeHref} style={{ padding: "12px 22px", fontSize: 14.5, fontWeight: 600, textDecoration: "none" }}>Revenir à l'accueil</a>
          </div>
          <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5, margin: "34px 0 0" }}>
            Ça recommence ?{" "}
            <a href={mailto} style={{ color: "var(--text2)", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}>Préviens-nous</a>, le détail de l'erreur est déjà dans le mail.
          </p>
        </div>
      </main>
    );
  }
}
