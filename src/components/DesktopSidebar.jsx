import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { TABS } from "../constants/tabs.js";

// ─── DESKTOP SIDEBAR ──────────────────────────────────────────────────────────
export function DesktopSidebar({ tab, setTab }) {
  const navigate = useNavigate();
  const guideActive = tab === "guide";
  return (
    <div className="desktop-sidebar">
      <div className="desktop-sidebar-logo">
        <svg className="sidebar-pod" viewBox="15 15 70 70" width="36" height="36" fill="none" aria-hidden="true">
          <path d="M50 15 C68 30 74 48 67 63 C62.5 74 55.5 80 50 85 C44.5 80 37.5 74 33 63 C26 48 32 30 50 15 Z" fill="var(--accent2)" />
          <g stroke="var(--accent-strong)" strokeLinecap="round">
            <path d="M50 24 C50 40 50 62 50 77" strokeWidth="4" />
            <path d="M42 30 C39.5 45 41 60 47 74" strokeWidth="3.4" />
            <path d="M58 30 C60.5 45 59 60 53 74" strokeWidth="3.4" />
          </g>
        </svg>
        <span className="wm">Cardam<span className="oh">o</span>me<span className="dot">·</span></span>
      </div>
      <nav style={{ flex: 1 }}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} className={`desktop-nav-item${active ? " active" : ""}`} onClick={() => setTab(t.id)}>
              <Icon name={t.icon} size={20} weight="duotone" color={active ? "var(--accent)" : "var(--text2)"} />
              {t.label}
            </button>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid var(--border)", margin: "0 10px 10px" }} />
      {/* Accès direct au guide utilisateur : plus utile au quotidien que les liens
          légaux, qui restent joignables depuis le pied de page / le menu profil. */}
      <button
        className={`desktop-nav-item sidebar-guide${guideActive ? " active" : ""}`}
        onClick={() => navigate("/guide")}
        aria-current={guideActive ? "page" : undefined}
        style={{ marginBottom: 12, height: "auto", alignItems: "flex-start" }}
      >
        <Icon name="help" size={20} weight="duotone" color={guideActive ? "var(--accent)" : "var(--text2)"} />
        <span style={{ display: "flex", flexDirection: "column", gap: 1, lineHeight: 1.25 }}>
          <span style={{ fontWeight: 600 }}>Guide utilisateur</span>
          <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text3)" }}>Prise en main &amp; astuces</span>
        </span>
      </button>
    </div>
  );
}
