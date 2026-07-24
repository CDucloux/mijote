import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { TABS } from "../constants/tabs.js";
import { codenameFor } from "../constants/changelog.js";
import { LEGAL_DOCS } from "../constants/legalDocs.js";

// ─── DESKTOP SIDEBAR ──────────────────────────────────────────────────────────
export function DesktopSidebar({ tab, setTab, onNewRecipe }) {
  const navigate = useNavigate();
  return (
    <div className="desktop-sidebar">
      <div className="desktop-sidebar-logo">Mijoté<span>·</span></div>
      <nav style={{ flex: 1 }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} className={`desktop-nav-item${active ? " active" : ""}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={18} color={active ? "var(--accent)" : "var(--text2)"} />
              {t.label}
            </button>
          );
        })}
      </nav>
      {/* Liens légaux : chrome discret, raccourci desktop vers la section /legal */}
      <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "2px 4px", lineHeight: 1.5 }}>
        {LEGAL_DOCS.map((d, i) => (
          <span key={d.id} style={{ display: "inline-flex", alignItems: "center" }}>
            {i > 0 && <span style={{ color: "var(--text3)", opacity: 0.5, margin: "0 3px", fontSize: 10 }}>·</span>}
            <button onClick={() => navigate(`/legal/${d.id}`)} className="sidebar-legal-link"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10.5, color: "var(--text3)", fontFamily: "var(--ff-body)" }}>
              {d.short}
            </button>
          </span>
        ))}
      </div>
      <div style={{ padding: "0 10px 14px", display: "flex", justifyContent: "center" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 9px", borderRadius: 20,
          background: "rgba(122, 155, 107, 0.18)",
          border: "1px solid rgba(122, 155, 107, 0.35)",
          color: "#8fba7a",
          fontSize: 11, fontWeight: 500, fontFamily: "var(--ff-body)", letterSpacing: "0.01em"
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8fba7a", flexShrink: 0 }} />
          {`v${__APP_VERSION__}${codenameFor(__APP_VERSION__) ? ` – ${codenameFor(__APP_VERSION__)}` : ""}`}
        </span>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", margin: "0 10px 14px" }} />
      <div style={{ padding: "0 10px" }}>
        <button className="btn btn-primary" style={{ width: "100%", borderRadius: 12 }} onClick={onNewRecipe}>
          <Icon name="plus" size={16} /> Nouvelle recette
        </button>
      </div>
    </div>
  );
}
