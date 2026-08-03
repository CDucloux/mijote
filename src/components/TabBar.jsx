import { Icon } from "./Icon.jsx";
import { TABS } from "../constants/tabs.js";

// ─── TAB BAR (mobile) ────────────────────────────────────────────────────────
// L'onglet actif est signalé par une pastille en surbrillance derrière l'icône
// (fond teinté à l'accent), en plus de la couleur et du libellé en gras.
export function TabBar({ tab, setTab }) {
  return (
    <div style={{ height: "var(--tab-h)", background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", flexShrink: 0 }}>
      {TABS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? "var(--accent)" : "var(--text3)", transition: "color 0.15s", padding: "6px 0" }}>
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 30, borderRadius: 16, background: active ? "var(--accent-soft, rgba(232,112,58,0.16))" : "transparent", transition: "background 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
              <Icon name={t.icon} size={20} color={active ? "var(--accent)" : "var(--text3)"} />
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
