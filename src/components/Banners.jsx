import { Icon } from "./Icon.jsx";

// ─── READ-ONLY BANNER ─────────────────────────────────────────────────────────
export function ReadOnlyBanner({ style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 14, background: "linear-gradient(135deg, rgba(155,135,245,0.20), rgba(155,135,245,0.06))", border: "1px solid rgba(155,135,245,0.38)", boxShadow: "0 2px 12px rgba(155,135,245,0.12)", ...style }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(155,135,245,0.85)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(155,135,245,0.45)" }}>
        <Icon name="book" size={16} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(155,135,245,1)", letterSpacing: "0.02em" }}>MODE LECTURE</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "rgba(155,135,245,0.85)", borderRadius: 5, padding: "1px 6px", letterSpacing: "0.04em" }}>READ ONLY</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>La base partagée est gérée par l'administrateur Cardamome ✦</div>
      </div>
    </div>
  );
}

// ─── ADMIN BANNER (shared Master DB notice) ───────────────────────────────────
// Single source of truth for the "MODE ADMIN" banner. `style` lets callers add
// spacing without duplicating the whole markup (e.g. marginBottom per section).
export function AdminBanner({ style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 14, background: "linear-gradient(135deg, rgba(var(--admin-rgb),0.20), rgba(var(--admin-rgb),0.06))", border: "1px solid rgba(var(--admin-rgb),0.38)", boxShadow: "0 2px 12px rgba(var(--admin-rgb),0.12)", ...style }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--admin)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(var(--admin-rgb),0.45)" }}>
        <Icon name="settings" size={16} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--admin)", letterSpacing: "0.02em" }}>MODE ADMIN</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "var(--admin)", borderRadius: 5, padding: "1px 6px", letterSpacing: "0.04em" }}>MASTER</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 1 }}>Tes modifications sont publiées dans la base partagée</div>
      </div>
    </div>
  );
}
