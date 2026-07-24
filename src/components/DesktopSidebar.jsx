import { Icon } from "./Icon.jsx";
import { TABS } from "../constants/tabs.js";
import { LEGAL_DOCS } from "../constants/legalDocs.js";

// ─── DESKTOP SIDEBAR ──────────────────────────────────────────────────────────
export function DesktopSidebar({ tab, setTab }) {
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
      <div style={{ borderTop: "1px solid var(--border)", margin: "0 10px 12px" }} />
      {/* Liens légaux : documents publics, ouverts dans un nouvel onglet. */}
      <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 1 }}>
        <div style={{ padding: "0 8px 6px", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text3)" }}>Informations légales</div>
        {LEGAL_DOCS.map(d => (
          <a key={d.id} href={`/legal/${d.id}`} target="_blank" rel="noopener noreferrer" className="sidebar-legal-link"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 8px", borderRadius: 8, fontSize: 12, color: "var(--text3)", textDecoration: "none" }}>
            <span>{d.short}</span>
            <Icon name="externalLink" size={12} color="currentColor" />
          </a>
        ))}
      </div>
    </div>
  );
}
