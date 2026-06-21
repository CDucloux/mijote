import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { useOnline } from "../hooks/useOnline.js";
import { useAppShell } from "../context/AppShellContext.jsx";

// ─── USER AVATAR (sync badge + sign-out popover) ─────────────────────────────
export function UserAvatar() {
  const { user, syncStatus, signOut: onSignOut, isDark, toggleTheme: onToggleTheme } = useAppShell();
  const [open, setOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const online = useOnline();
  if (!user) return null;
  const offline = !online;
  const syncLabel = offline ? "⚡ Hors ligne — synchro à la reconnexion"
    : syncStatus === "syncing" ? "Synchronisation…" : syncStatus === "synced" ? "✓ Synchronisé" : syncStatus === "error" ? "⚠ Erreur sync" : null;
  const syncColor = offline ? "var(--orange)" : syncStatus === "synced" ? "var(--green)" : syncStatus === "error" ? "var(--red)" : "var(--text3)";
  const showDot = offline || syncStatus !== "idle";
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => { setOpen(o => !o); setConfirmSignOut(false); }} style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Mon compte">
        {user.photoURL
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 38, height: 38, borderRadius: "50%", display: "block", border: "2px solid var(--border)" }} />
          : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff" }}>{(user.displayName || "?")[0].toUpperCase()}</div>
        }
        <span style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: syncColor, border: "2px solid var(--bg)", display: showDot ? "block" : "none" }} />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 299 }} onClick={() => { setOpen(false); setConfirmSignOut(false); }} />
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 16px", zIndex: 300, minWidth: 210, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", animation: "expandDown 0.2s ease" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{(user.displayName || "").toUpperCase()}</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{user.email}</div>
            {syncLabel && <div style={{ fontSize: 11, color: syncColor, marginBottom: 10 }}>{syncLabel}</div>}
            {onToggleTheme && (
              <>
                <div style={{ height: 1, background: "var(--border)", margin: "8px -4px" }} />
                <button onClick={onToggleTheme} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "6px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 12, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
                  <Icon name={isDark ? "sun" : "moon"} size={13} color="currentColor" />
                  {isDark ? "Mode clair" : "Mode sombre"}
                </button>
                <div style={{ height: 1, background: "var(--border)", margin: "8px -4px" }} />
              </>
            )}
            {!confirmSignOut
              ? <button onClick={() => setConfirmSignOut(true)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", marginTop: 4, borderRadius: 11, background: "rgba(224,82,82,0.10)", border: "1px solid rgba(224,82,82,0.25)", color: "var(--red)", fontFamily: "var(--ff-body)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(224,82,82,0.18)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(224,82,82,0.10)"; }}>
                <Icon name="logout" size={16} color="var(--red)" /> Se déconnecter
              </button>
              : <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 8, textAlign: "center" }}>Confirmer la déconnexion ?</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => setConfirmSignOut(false)}>Annuler</button>
                  <button className="btn btn-danger btn-sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => { setOpen(false); setConfirmSignOut(false); onSignOut(); }}>Confirmer</button>
                </div>
              </div>
            }
          </div>
        </>
      )}
    </div>
  );
}
