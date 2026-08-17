import { Icon } from "./Icon.jsx";
import { TABS } from "../constants/tabs.js";

// ─── TAB BAR (mobile) ────────────────────────────────────────────────────────
// L'onglet actif est signalé par une pastille en surbrillance derrière l'icône
// (fond teinté à l'accent), en plus de la couleur et du libellé en gras.
export function TabBar({ tab, setTab }) {
  // `paddingBottom` = zone système du bas (gestes Android / home indicator iOS) :
  // en PWA edge-to-edge, la barre de navigation de l'OS affiche les pixels de la
  // page à cet endroit → on y étend le fond `--surface` pour qu'elle prenne la
  // couleur de l'appli (thème) plutôt que la couleur système. La rangée d'onglets
  // garde sa hauteur `--tab-h` dans un conteneur interne.
  return (
    <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0, paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div style={{ height: "var(--tab-h)", display: "flex", alignItems: "center" }}>
      {TABS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? "var(--accent)" : "var(--text3)", transition: "color 0.15s", padding: "6px 0" }}>
            <span className="ripple ripple-accent" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 30, borderRadius: 16, background: active ? "var(--accent-soft, rgba(232,112,58,0.16))" : "transparent", transition: "background 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
              <Icon name={t.icon} size={20} color={active ? "var(--accent)" : "var(--text3)"} />
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{t.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
