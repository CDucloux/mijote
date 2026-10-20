import { Icon } from "../ui/Icon.jsx";
import type { IconName } from "../ui/Icon.jsx";
import { UserAvatar } from "../user/UserAvatar.jsx";
import { OverscrollRow } from "../ui/OverscrollRow.jsx";
import { ReadOnlyBanner, AdminBanner } from "../ui/Banners.jsx";
import type { ConsoleSection } from "../../constants/tabs.js";

const SECTIONS: [ConsoleSection, string, IconName][] = [
  ["dashboard", "Vue d'ensemble", "grid"], ["ingredients", "Ingrédients", "leaf"], ["ustensiles", "Ustensiles", "utensils"],
  ["techniques", "Techniques", "list2"], ["sources", "Sources", "star"], ["modération", "Modération", "warning"],
];

interface ConsoleHeaderProps {
  section: ConsoleSection;
  onSection: (section: ConsoleSection) => void;
  isAdmin: boolean;
  /** Signalements en attente, en pastille sur l'onglet Modération. */
  pendingReports: number;
  /** Taille de la base affichée (sections Ingrédients, Ustensiles, Techniques). */
  baseCount: { count: number; noun: string } | null;
}

/** En-tête figé de la console : titre, onglets de section, compteur de la base. */
export function ConsoleHeader({ section, onSection, isAdmin, pendingReports, baseCount }: ConsoleHeaderProps) {
  return (
    <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(var(--admin-rgb),0.14)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="terminal" size={16} color="var(--admin)" />
          </span>
          <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Console admin</h1>
        </div>
        <UserAvatar />
      </div>
      <OverscrollRow stretch style={{ gap: 6 }}>
        {SECTIONS.map(([s, label, ic]) => {
          const active = section === s;
          return (
            <button key={s} onClick={() => onSection(s)} className={active ? "ripple ripple-light" : "hover-neutral hover-ring ripple"} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: active ? "var(--accent)" : "var(--surface)", color: active ? "#fff" : "var(--text2)", border: `1px solid ${active ? "transparent" : "var(--border)"}` }}>
              <Icon name={ic} size={13} color="currentColor" /> {label}
              {s === "modération" && pendingReports > 0 && (
                <span style={{ fontSize: 10, fontWeight: 600, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", background: active ? "rgba(255,255,255,0.28)" : "var(--red)", color: "#fff" }}>{pendingReports}</span>
              )}
            </button>
          );
        })}
      </OverscrollRow>
      {/* Compteur + bannière admin : figés avec l'en-tête (restent visibles au scroll). */}
      {baseCount && (
        <div style={{ paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 12, color: "var(--text2)", padding: "0 2px", marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", fontFamily: "var(--ff-display)" }}>{baseCount.count}</span>
            <span>{baseCount.noun}{baseCount.count > 1 ? "s" : ""} dans la base</span>
          </div>
          {isAdmin ? <AdminBanner style={{ marginBottom: 6 }} /> : <ReadOnlyBanner style={{ marginBottom: 6 }} />}
        </div>
      )}
    </div>
  );
}
