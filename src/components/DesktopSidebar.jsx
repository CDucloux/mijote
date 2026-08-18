import { Icon } from "./Icon.jsx";
import { TABS } from "../constants/tabs.js";
import { LEGAL_DOCS } from "../constants/legalDocs.js";

// ─── DESKTOP SIDEBAR ──────────────────────────────────────────────────────────
export function DesktopSidebar({ tab, setTab }) {
  return (
    <div className="desktop-sidebar">
      <div className="desktop-sidebar-logo">
        <svg className="sidebar-pod" viewBox="0 0 100 100" width="24" height="24" fill="none" aria-hidden="true">
          <path d="M50 15 C68 30 74 48 67 63 C62.5 74 55.5 80 50 85 C44.5 80 37.5 74 33 63 C26 48 32 30 50 15 Z" fill="var(--accent2)" />
          <g stroke="var(--accent-strong)" strokeLinecap="round">
            <path d="M50 24 C50 40 50 62 50 77" strokeWidth="4" />
            <path d="M42 30 C39.5 45 41 60 47 74" strokeWidth="3.4" />
            <path d="M58 30 C60.5 45 59 60 53 74" strokeWidth="3.4" />
          </g>
        </svg>
        <span className="wm">Cardamome<span className="dot">·</span></span>
      </div>
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
