import React from "react";
import { Icon } from "./Icon.jsx";
import { CHANGELOG } from "../constants/changelog.js";
import { renderInline } from "./markdownInline.jsx";

export function ChangelogSection() {
  const [open, setOpen] = React.useState({});
  const toggle = v => setOpen(p => ({ ...p, [v]: !p[v] }));
  // On n'affiche que les 5 dernières versions : au-delà, la sheet « À propos »
  // devient trop lourde (l'historique complet reste dans CHANGELOG.md).
  const entries = CHANGELOG.slice(0, 5);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {entries.map((entry, i) => {
        const isLatest = i === 0;
        const isExpanded = isLatest || !!open[entry.version];
        return (
          <div key={entry.version} className="slide-up" style={{ display: "flex", gap: 0, animationDelay: `${i * 0.05}s` }}>
            {/* Timeline rail */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
              <div style={{ width: isLatest ? 13 : 9, height: isLatest ? 13 : 9, borderRadius: "50%", background: isLatest ? "var(--accent)" : "var(--border)", border: isLatest ? "3px solid var(--accent)" : "2px solid var(--border)", boxShadow: isLatest ? "0 0 0 4px rgba(232,112,58,0.18)" : "none", marginTop: isLatest ? 14 : 16, zIndex: 1, flexShrink: 0 }} />
              {i < entries.length - 1 && <div style={{ flex: 1, width: 2, background: "var(--border)", marginTop: 4, marginBottom: 0 }} />}
            </div>
            {/* Card */}
            <div style={{ flex: 1, marginBottom: 16, marginLeft: 10 }}>
              <button onClick={() => !isLatest && toggle(entry.version)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: isLatest ? "14px 16px 12px" : "12px 16px", background: isLatest ? "linear-gradient(135deg,rgba(232,112,58,0.10),rgba(232,112,58,0.03))" : "var(--surface)", border: isLatest ? "1px solid rgba(232,112,58,0.35)" : "1px solid var(--border)", borderRadius: isExpanded ? "14px 14px 0 0" : 14, cursor: isLatest ? "default" : "pointer", textAlign: "left", transition: "border-radius 0.2s" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                    <span style={{ fontFamily: "var(--ff-display)", fontSize: 15, fontWeight: 600, color: isLatest ? "var(--accent)" : "var(--text)" }}>v{entry.version}</span>
                    {isLatest
                      ? <span style={{ fontSize: 9, fontWeight: 800, color: "#fff", background: "var(--accent)", borderRadius: 6, padding: "2px 8px", letterSpacing: "0.06em" }}>DERNIÈRE VERSION</span>
                      : <span style={{ fontSize: 11, color: "var(--text3)" }}>{entry.label}</span>}
                  </div>
                  {isLatest && <div style={{ fontSize: 12, color: "var(--text2)" }}>{entry.label}</div>}
                </div>
                {!isLatest && (
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform 0.25s", transform: isExpanded ? "rotate(-90deg)" : "rotate(90deg)", flexShrink: 0 }}>
                    <Icon name="forward" size={11} color="var(--text3)" />
                  </div>
                )}
              </button>
              {isExpanded && (
                <div style={{ background: isLatest ? "linear-gradient(135deg,rgba(232,112,58,0.06),rgba(232,112,58,0.01))" : "var(--surface)", border: isLatest ? "1px solid rgba(232,112,58,0.35)" : "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 14px 14px", padding: "10px 16px 14px", animation: "expandDown 0.2s ease", display: "flex", flexDirection: "column", gap: 7 }}>
                  {entry.items.map((item, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: isLatest ? "var(--accent)" : "var(--border)", marginTop: 7, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: isLatest ? "var(--text)" : "var(--text2)", lineHeight: 1.55 }}>{renderInline(item)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
