import { Icon } from "./Icon.jsx";
import { TABS } from "../constants/tabs.js";

// ─── TAB BAR (mobile) ────────────────────────────────────────────────────────
export function TabBar({ tab, setTab }) {
  return (
    <div style={{ height: "var(--tab-h)", background: "var(--surface)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", flexShrink: 0 }}>
      {TABS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: active ? "var(--accent)" : "var(--text3)", transition: "color 0.15s", padding: "8px 0" }}>
            <Icon name={t.icon} size={20} color={active ? "var(--accent)" : "var(--text3)"} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
