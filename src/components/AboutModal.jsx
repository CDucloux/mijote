import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";
import { ChangelogSection } from "./ChangelogSection.jsx";
import { codenameFor } from "../constants/changelog.js";
import { Row, Col, Pill, IconChip } from "./ui/primitives.jsx";

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
    <Col gap={8}>
      <Row gap={8}>
        <Icon name={icon} size={15} color="var(--accent)" />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text3)" }}>{title}</span>
      </Row>
      {children}
    </Col>
  );
}

export function AboutModal({ onClose }) {
  return (
    <SwipeableSheet onClose={onClose} style={{ maxWidth: 460 }}>
      <Col gap={22} style={{ padding: "4px 20px 24px" }}>
        {/* En-tête */}
        <Col align="center" gap={8} style={{ paddingTop: 6 }}>
          <Row gap={9} justify="center" style={{ alignItems: "center" }}>
            <svg viewBox="15 15 70 70" width="40" height="40" fill="none" aria-hidden="true">
              <path d="M50 15 C68 30 74 48 67 63 C62.5 74 55.5 80 50 85 C44.5 80 37.5 74 33 63 C26 48 32 30 50 15 Z" fill="var(--accent2)" />
              <g stroke="var(--accent-strong)" strokeLinecap="round">
                <path d="M50 24 C50 40 50 62 50 77" strokeWidth="4" />
                <path d="M42 30 C39.5 45 41 60 47 74" strokeWidth="3.4" />
                <path d="M58 30 C60.5 45 59 60 53 74" strokeWidth="3.4" />
              </g>
            </svg>
            <div style={{ fontFamily: "var(--ff-display)", fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}>
              Cardam<span style={{ color: "var(--accent)" }}>o</span>me<span style={{ color: "var(--accent)" }}>·</span>
            </div>
          </Row>
          <Pill style={{ padding: "3px 11px", background: "rgba(122, 155, 107, 0.18)", border: "1px solid rgba(122, 155, 107, 0.35)", color: "#8fba7a", fontSize: 12, fontWeight: 500, fontFamily: "var(--ff-body)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8fba7a", flexShrink: 0 }} />
            {`v${__APP_VERSION__}${codename ? ` – ${codename}` : ""}`}
          </Pill>
          <div style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", marginTop: 2 }}>
            Cuisine mieux, organise moins.
          </div>
        </Col>

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Auteur */}
        <Section icon="leaf" title="Conçu & développé par">
          <Row as="a" justify="space-between" gap={10} href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
            style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(var(--accent-rgb),0.07)", border: "1px solid rgba(var(--accent-rgb),0.18)", textDecoration: "none", transition: "border-color 0.15s, background 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "rgba(var(--accent-rgb),0.13)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(var(--accent-rgb),0.18)"; e.currentTarget.style.background = "rgba(var(--accent-rgb),0.07)"; }}>
            <Col>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Corentin Ducloux</span>
              <span style={{ fontSize: 11, color: "var(--text3)" }}>@CDucloux · GitHub</span>
            </Col>
            <Icon name="externalLink" size={16} color="var(--text3)" />
          </Row>
        </Section>

        {/* Crédits */}
        <Section icon="sparkle" title="Construit avec">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {CREDITS.map(c => (
              <Row key={c.label} gap={10} style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(var(--accent-rgb),0.07)", border: "1px solid rgba(var(--accent-rgb),0.18)" }}>
                <IconChip size={30} radius={9} tint="var(--surface)" style={{ border: "1px solid rgba(var(--accent-rgb),0.18)", fontSize: 15 }}>{c.glyph}</IconChip>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap" }}>{c.label}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.detail}</div>
                </div>
              </Row>
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

        {/* Nouveautés (en bas de la fenêtre) */}
        <Section icon="sparkle" title="Nouveautés">
          <ChangelogSection />
        </Section>

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Copyright */}
        <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
          © {YEAR} Cardamome. Tous droits réservés.
        </div>
      </Col>
    </SwipeableSheet>
  );
}
