import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { CHANGELOG } from "../constants/changelog.js";
import { renderInline } from "../lib/markdownInline.jsx";

const ANNOUNCE_SEEN_KEY = "rf_announce_seen";

export function AnnouncementPopup() {
  const navigate = useNavigate();
  const latest = CHANGELOG[0];
  const highlights = latest?.highlights || [];
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(ANNOUNCE_SEEN_KEY) === latest?.version; } catch { return false; }
  });
  if (!highlights.length || dismissed) return null;
  const close = () => {
    try { localStorage.setItem(ANNOUNCE_SEEN_KEY, latest.version); } catch { }
    setDismissed(true);
  };
  return (
    <div
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.45)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 360, borderRadius: 20,
          background: "var(--surface)", boxShadow: "0 8px 40px rgba(0,0,0,0.28)",
          overflow: "hidden",
        }}
      >
        <div style={{
          background: "linear-gradient(135deg, rgba(232,112,58,0.18), rgba(232,112,58,0.06))",
          borderBottom: "1px solid rgba(232,112,58,0.25)",
          padding: "20px 20px 16px",
          display: "flex", alignItems: "flex-start", gap: 14,
        }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 3px 10px rgba(232,112,58,0.45)" }}>
            <Icon name="sparkle" size={20} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--accent)", letterSpacing: "0.03em" }}>NOUVEAUTÉS</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--accent)", borderRadius: 6, padding: "2px 7px" }}>v{latest.version}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text2)", lineHeight: 1.4 }}>Voici ce qui a changé dans cette version :</p>
          </div>
        </div>
        <ul style={{ margin: 0, padding: "14px 20px", listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {highlights.map((h, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--text1)", lineHeight: 1.4 }}>
              <span style={{ marginTop: 5, flexShrink: 0, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "block" }} />
              <span>{renderInline(h)}</span>
            </li>
          ))}
        </ul>
        <div style={{ padding: "12px 20px 18px", display: "flex", gap: 10 }}>
          <button
            onClick={() => { close(); navigate("/config/changelog"); }}
            style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "1px solid var(--accent)", background: "transparent", color: "var(--accent)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Voir les détails
          </button>
          <button
            onClick={close}
            style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
