import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";
import { ChangelogSection } from "./ChangelogSection.jsx";
import { codenameFor } from "../constants/changelog.js";

// ─── À PROPOS (licence · crédits · copyright) ────────────────────────────────
// Volontairement hors de Config : la page vit dans la zone profil (avatar), qui
// regroupe déjà le « méta » de l'app (compte, thème, synchro).
const YEAR = new Date().getFullYear();
const codename = codenameFor(__APP_VERSION__);

const GITHUB_URL = "https://github.com/CDucloux";

const CREDITS = [
  { label: "React", detail: "Interface", glyph: "⚛" },
  { label: "Vite", detail: "Build & dev", glyph: "⚡" },
  { label: "Firebase", detail: "Auth · Sync · Storage", glyph: "🔥" },
  { label: "React Router", detail: "Navigation", glyph: "🧭" },
];

function Section({ icon, title, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name={icon} size={15} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text3)" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export function AboutModal({ onClose }) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxWidth: 460 }}>
      <div style={{ padding: "4px 20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
        {/* En-tête */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, paddingTop: 6 }}>
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--text)" }}>
            Mijoté<span style={{ color: "var(--accent)" }}>·</span>
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px", borderRadius: 20,
            background: "rgba(122, 155, 107, 0.18)", border: "1px solid rgba(122, 155, 107, 0.35)",
            color: "#8fba7a", fontSize: 12, fontWeight: 500, fontFamily: "var(--ff-body)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8fba7a", flexShrink: 0 }} />
            {`v${__APP_VERSION__}${codename ? ` – ${codename}` : ""}`}
          </span>
          <div style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", marginTop: 2 }}>
            Cuisine mieux, organise moins.
          </div>
        </div>

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Nouveautés */}
        <Section icon="sparkle" title="Nouveautés">
          <ChangelogSection />
        </Section>

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Auteur */}
        <Section icon="leaf" title="Conçu & développé par">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px", borderRadius: 12, background: "rgba(232,112,58,0.07)", border: "1px solid rgba(232,112,58,0.18)", textDecoration: "none", transition: "border-color 0.15s, background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(232,112,58,0.13)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(232,112,58,0.18)"; e.currentTarget.style.background = "rgba(232,112,58,0.07)"; }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Corentin Ducloux</span>
              <span style={{ fontSize: 11, color: "var(--text3)" }}>@CDucloux · GitHub</span>
            </div>
            <Icon name="externalLink" size={16} color="var(--text3)" />
          </a>
        </Section>

        {/* Crédits */}
        <Section icon="sparkle" title="Construit avec">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {CREDITS.map(c => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(232,112,58,0.07)", border: "1px solid rgba(232,112,58,0.18)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--surface)", border: "1px solid rgba(232,112,58,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{c.glyph}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>{c.label}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Licence */}
        <Section icon="fileText" title="Licence">
          <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
            Logiciel propriétaire – <strong style={{ color: "var(--text)" }}>tous droits réservés</strong>. Le code
            source, le design et les contenus associés ne peuvent être copiés, distribués ou modifiés sans
            autorisation écrite.
          </div>
        </Section>

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Copyright */}
        <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
          © {YEAR} Mijoté. Tous droits réservés.
        </div>
      </div>
    </SwipeableSheet>
  );
}
