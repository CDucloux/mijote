import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { useOnline } from "../hooks/useOnline.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { AboutModal } from "./AboutModal.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";

// ─── USER AVATAR (sync badge + sign-out popover) ─────────────────────────────
export function UserAvatar() {
  const { user, syncStatus, signOut: onSignOut, isDark, toggleTheme: onToggleTheme, isAdmin, isPlus } = useAppShell();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);
  const online = useOnline();
  // Le changelog vit dans « À propos » : d'autres composants (popup de nouveautés)
  // demandent son ouverture via un événement global plutôt qu'en dupliquant la modale.
  useEffect(() => {
    const openAbout = () => setAbout(true);
    window.addEventListener("mijote:show-about", openAbout);
    return () => window.removeEventListener("mijote:show-about", openAbout);
  }, []);

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
        {/* Anneau orange = abonné Mijoté+ (sinon bordure neutre). */}
        {user.photoURL
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 38, height: 38, borderRadius: "50%", display: "block", border: `2px solid ${isPlus ? "var(--accent)" : "var(--border)"}` }} />
          : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", border: `2px solid ${isPlus ? "var(--accent)" : "transparent"}` }}>{(user.displayName || "?")[0].toUpperCase()}</div>
        }
        <span style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: syncColor, border: "2px solid var(--bg)", display: showDot ? "block" : "none" }} />
      </button>
      {open && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 1299 }} onClick={() => { setOpen(false); setConfirmSignOut(false); }} />
          <div style={{ position: "fixed", top: dropPos.top, right: dropPos.right, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 16px", zIndex: 1300, minWidth: 210, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", animation: "expandDown 0.2s ease" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{user.email}</div>
            {syncLabel && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: syncColor, marginBottom: 4 }}>{offline && <Icon name="wifiOff" size={12} color={syncColor} />}{syncLabel}</div>}
            <div style={{ height: 1, background: "var(--border)", margin: "8px -4px" }} />
            {isAdmin && (
              <button onClick={() => { setOpen(false); navigate("/admin/dashboard"); }}
                style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--accent)", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "opacity 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                <Icon name="terminal" size={13} color="currentColor" /> Console admin
              </button>
            )}
            <button onClick={() => { setOpen(false); navigate("/profile"); }}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="user" size={13} color="currentColor" /> Profil
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
      {confirmSignOut && (
        <ConfirmDialog title="Se déconnecter ?" icon="logout" confirmLabel="Déconnexion" busyLabel="Déconnexion…" busy={signingOut} zIndex={1400}
          onCancel={() => setConfirmSignOut(false)}
          onConfirm={async () => {
            setSigningOut(true);
            // La révocation Firebase est quasi-instantanée : on garde le spinner
            // affiché au moins ~650 ms pour qu'il soit perceptible (sinon on le voit à peine).
            try { await Promise.all([onSignOut(), new Promise(r => setTimeout(r, 650))]); }
            catch { setSigningOut(false); }
          }}>
          Tes recettes restent synchronisées. Tu pourras te reconnecter à tout moment.
        </ConfirmDialog>
      )}
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  );
}
