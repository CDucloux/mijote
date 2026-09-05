import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";
import { ElasticScroll } from "../components/ElasticScroll.jsx";
import { NotificationsSection } from "../components/NotificationsSection.jsx";

// ─── NOTIFICATIONS ──────────────────────────────────────────────────────────────
// Page dédiée /notifications : le journal d'activité du foyer, accessible depuis le
// bouton rond de l'en-tête d'accueil. En-tête standard (titre serif 26/600) avec un
// retour vers l'accueil ; le contenu (liste + état vide) vit dans NotificationsSection.
export function NotificationsPage({ activities = [] }) {
  const navigate = useNavigate();
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 20px 14px", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/home")} aria-label="Retour"
          style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--surface2)", display: "grid", placeItems: "center", flexShrink: 0, border: "none", cursor: "pointer" }}>
          <Icon name="back" size={17} />
        </button>
        <div>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.1 }}>
            Notifications
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "var(--text3)" }}>Ton activité récente</p>
        </div>
      </div>

      <ElasticScroll style={{ flex: 1, padding: "4px 20px var(--page-pad-b)" }}>
        <NotificationsSection activities={activities} />
      </ElasticScroll>
    </div>
  );
}
