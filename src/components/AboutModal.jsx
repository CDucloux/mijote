import { SwipeableSheet } from "./SwipeableSheet.jsx";
import { Icon } from "./Icon.jsx";
import { codenameFor } from "../constants/changelog.js";

// ─── À PROPOS (licence · crédits · copyright) ────────────────────────────────
// Volontairement hors de Config : la page vit dans la zone profil (avatar), qui
// regroupe déjà le « méta » de l'app (compte, thème, synchro).
const YEAR = new Date().getFullYear();
const codename = codenameFor(__APP_VERSION__);

const CREDITS = [
  { label: "React", detail: "Interface" },
  { label: "Vite", detail: "Build & dev" },
  { label: "Firebase", detail: "Auth · Firestore · Storage" },
  { label: "React Router", detail: "Navigation" },
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
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 30, fontWeight: 700, color: "var(--text)" }}>
            Mijoté<span style={{ color: "var(--accent)" }}>·</span>
          </div>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px", borderRadius: 20,
            background: "rgba(122, 155, 107, 0.18)", border: "1px solid rgba(122, 155, 107, 0.35)",
            color: "#8fba7a", fontSize: 12, fontWeight: 500, fontFamily: "var(--ff-body)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#8fba7a", flexShrink: 0 }} />
            {`v${__APP_VERSION__}${codename ? ` — ${codename}` : ""}`}
          </span>
          <div style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", marginTop: 2 }}>
            Cuisinez mieux, organisez moins.
          </div>
        </div>

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Auteur */}
        <Section icon="leaf" title="Conçu & développé par">
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Corentin Ducloux</div>
        </Section>

        {/* Crédits */}
        <Section icon="sparkle" title="Construit avec">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {CREDITS.map(c => (
              <div key={c.label} style={{ padding: "9px 12px", borderRadius: 11, background: "var(--surface2)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{c.label}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{c.detail}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Licence */}
        <Section icon="fileText" title="Licence">
          <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.6 }}>
            Logiciel propriétaire — <strong style={{ color: "var(--text)" }}>tous droits réservés</strong>. Le code
            source, le design et les contenus associés ne peuvent être copiés, distribués ou modifiés sans
            autorisation écrite de l'auteur.
          </div>
        </Section>

        <div style={{ height: 1, background: "var(--border)" }} />

        {/* Copyright */}
        <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center" }}>
          © {YEAR} Corentin Ducloux. Tous droits réservés.
        </div>
      </div>
    </SwipeableSheet>
  );
}
