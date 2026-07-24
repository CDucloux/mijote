import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { useOnline } from "../hooks/useOnline.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { AboutModal } from "./AboutModal.jsx";

// ─── USER AVATAR (sync badge + sign-out popover) ─────────────────────────────
export function UserAvatar() {
  const { user, syncStatus, signOut: onSignOut, isDark, toggleTheme: onToggleTheme } = useAppShell();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const online = useOnline();
  const { household } = useHousehold();

  const openDropdown = () => {
    if (btnRef.current) {
      // Le menu est porté dans <body> (hors du #root mis à l'échelle) : on utilise
      // donc les coordonnées écran brutes de getBoundingClientRect, sans diviser
      // par --page-zoom. C'est ce portail qui évite que le menu passe sous l'UI.
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  };
  if (!user) return null;
  const offline = !online;
  const syncLabel = offline ? "Hors ligne"
    : syncStatus === "syncing" ? "Synchronisation…" : syncStatus === "synced" ? "✓ Synchronisé" : syncStatus === "error" ? "⚠ Erreur sync" : null;
  const syncColor = offline ? "var(--orange)" : syncStatus === "synced" ? "var(--green)" : syncStatus === "error" ? "var(--red)" : "var(--text3)";
  const showDot = offline || syncStatus !== "idle";
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button ref={btnRef} onClick={() => { if (open) { setOpen(false); setConfirmSignOut(false); } else { setConfirmSignOut(false); openDropdown(); } }} style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} aria-label="Mon compte">
        {user.photoURL
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 38, height: 38, borderRadius: "50%", display: "block", border: `2px solid ${household ? "var(--accent)" : "var(--border)"}` }} />
          : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", border: household ? "2px solid var(--accent)" : undefined }}>{(user.displayName || "?")[0].toUpperCase()}</div>
        }
        {household && (
          <span title={`Foyer : ${household.name}`} style={{ position: "absolute", top: -2, left: -2, width: 16, height: 16, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3.5 11 12 4l8.5 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.5 9.5V19h13V9.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        <span style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: syncColor, border: "2px solid var(--bg)", display: showDot ? "block" : "none" }} />
      </button>
      {open && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 1299 }} onClick={() => { setOpen(false); setConfirmSignOut(false); }} />
          <div style={{ position: "fixed", top: dropPos.top, right: dropPos.right, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 16px", zIndex: 1300, minWidth: 210, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", animation: "expandDown 0.2s ease" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{user.email}</div>
            {syncLabel && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: syncColor, marginBottom: 4 }}>{offline && <Icon name="wifiOff" size={12} color={syncColor} />}{syncLabel}</div>}
            <div style={{ height: 1, background: "var(--border)", margin: "8px -4px" }} />
            <button onClick={() => { setOpen(false); navigate("/profile"); }}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="user" size={13} color="currentColor" /> Profil
            </button>
            <button onClick={() => { setOpen(false); navigate("/config/preferences"); }}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="settings" size={13} color="currentColor" /> Paramètres
            </button>
            {onToggleTheme && (
              <button onClick={onToggleTheme} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
                onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
                <Icon name={isDark ? "sun" : "moon"} size={13} color="currentColor" />
                {isDark ? "Mode clair" : "Mode sombre"}
              </button>
            )}
            <button onClick={() => { setOpen(false); window.dispatchEvent(new Event("mijote:show-onboarding")); }}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="sparkle" size={13} color="currentColor" /> Revoir l'introduction
            </button>
            <button onClick={() => { setOpen(false); setAbout(true); }}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="info" size={13} color="currentColor" /> À propos
            </button>
            <button onClick={() => { setOpen(false); navigate("/legal"); }}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="fileText" size={13} color="currentColor" /> Informations légales
            </button>
            <div style={{ height: 1, background: "var(--border)", margin: "8px -4px" }} />
            <button onClick={() => { setOpen(false); setConfirmSignOut(true); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", marginTop: 4, borderRadius: 11, background: "rgba(224,82,82,0.10)", border: "1px solid rgba(224,82,82,0.25)", color: "var(--red)", fontFamily: "var(--ff-body)", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(224,82,82,0.18)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(224,82,82,0.10)"; }}>
              <Icon name="logout" size={16} color="var(--red)" /> Se déconnecter
            </button>
          </div>
        </>,
        document.body
      )}
      {confirmSignOut && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 1400, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn 0.18s ease" }}
          onClick={() => setConfirmSignOut(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: "26px 22px 20px", boxShadow: "0 20px 60px rgba(0,0,0,0.45)", textAlign: "center", animation: "modalIn 0.32s cubic-bezier(0.16,1,0.3,1)" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(224,82,82,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Icon name="logout" size={24} color="var(--red)" />
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>Se déconnecter ?</div>
            <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5, marginBottom: 22 }}>
              Vos recettes restent synchronisées. Vous pourrez vous reconnecter à tout moment.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmSignOut(false)} style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text2)", fontFamily: "var(--ff-body)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Annuler</button>
              <button onClick={() => { setConfirmSignOut(false); onSignOut(); }} style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: "var(--red)", border: "1px solid var(--red)", color: "#fff", fontFamily: "var(--ff-body)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Déconnexion</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  );
}
