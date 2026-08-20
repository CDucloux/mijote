import { Icon } from "./Icon.jsx";
import { TABS } from "../constants/tabs.js";

// ─── TAB BAR (mobile) ────────────────────────────────────────────────────────
// L'onglet actif est signalé par une pastille en surbrillance derrière l'icône
// (fond teinté à l'accent), en plus de la couleur et du libellé en gras.
export function TabBar({ tab, setTab }) {
  // `paddingBottom` = zone système du bas (gestes Android / home indicator iOS),
  // pilotée par `--tab-pad-b` (source unique, cf. global.css) : en PWA / navigateur,
  // elle vaut la safe-area et le fond `--surface` s'y étend pour prendre la couleur
  // de l'appli plutôt que celle du système ; dans la coquille Capacitor, elle est
  // calée sur un plancher fixe pour garder les onglets au-dessus de la zone de
  // gestes système. La rangée garde sa hauteur `--tab-h`.
  return (
    <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0, paddingBottom: "var(--tab-pad-b)" }}>
      <div style={{ height: "var(--tab-h)", display: "flex", alignItems: "center" }}>
      {TABS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? "var(--accent)" : "var(--text3)", transition: "color 0.15s", padding: "6px 0" }}>
            <span className="ripple ripple-accent" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 30, borderRadius: 16, background: active ? "var(--accent-soft, rgba(var(--accent-rgb),0.16))" : "transparent", transition: "background 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
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
