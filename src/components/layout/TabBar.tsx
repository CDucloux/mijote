import { Icon, type IconName } from "../ui/Icon.jsx";
import { TABS } from "../../constants/tabs.js";

interface TabBarProps {
  tab: string;
  setTab: (tab: string) => void;
}

// Tab bar (mobile) : l'onglet actif est signalé par une pastille en surbrillance
// derrière l'icône (fond teinté à l'accent), en plus de la couleur et du gras.
export function TabBar({ tab, setTab }: TabBarProps) {
  // `paddingBottom` = zone système du bas (gestes Android / home indicator iOS),
  // pilotée par `--tab-pad-b` (source unique, cf. global.css). La rangée garde sa
  // hauteur `--tab-h`.
  return (
    <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", flexShrink: 0, paddingBottom: "var(--tab-pad-b)" }}>
      <div style={{ height: "var(--tab-h)", display: "flex", alignItems: "center" }}>
      {TABS.map(t => {
        const active = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? "var(--accent)" : "var(--text3)", transition: "color 0.15s", padding: "6px 0" }}>
            <span className="ripple ripple-accent" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 30, borderRadius: 16, background: active ? "var(--accent-soft, rgba(var(--accent-rgb),0.16))" : "transparent", transition: "background 0.2s cubic-bezier(0.4,0,0.2,1)" }}>
              <Icon name={t.icon as IconName} size={22} weight="duotone" color={active ? "var(--accent)" : "var(--text3)"} />
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{t.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
