import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "./Icon.jsx";
import { useOnline } from "../hooks/useOnline.js";
import { useAppShell } from "../context/AppShellContext.jsx";
import { AboutModal } from "./AboutModal.jsx";
import { ConfirmDialog } from "./ConfirmDialog.jsx";
import { useModalExit } from "../hooks/useModalExit.js";
import { CONTACT_MAILTO } from "../constants/contact.js";

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
  // Sortie animée du menu (sinon il disparaissait d'un coup). `closing` bascule la
  // pastille sur la keyframe collapseUp, puis onAnimationEnd applique la fermeture.
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit(
    () => { setOpen(false); setConfirmSignOut(false); },
    { disabled: !open }
  );
  // Ferme en jouant la sortie, puis exécute l'action (navigation, ouverture d'une
  // autre modale…) une fois l'animation terminée.
  const closeThen = (fn) => beginClose(() => { setOpen(false); setConfirmSignOut(false); fn?.(); });
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
  const syncColor = offline ? "var(--orange)" : syncStatus === "synced" ? "var(--ok)" : syncStatus === "error" ? "var(--red)" : "var(--text3)";
  const showDot = offline || syncStatus !== "idle";
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button ref={btnRef} className="ripple ripple-light" onClick={() => { if (open) { closeThen(); } else { setConfirmSignOut(false); openDropdown(); } }} style={{ position: "relative", padding: 0, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }} aria-label="Mon compte">
        {/* Anneau orange = abonné Cardamome+ (sinon bordure neutre). */}
        {user.photoURL
          ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 38, height: 38, borderRadius: "50%", display: "block", border: `2px solid ${isPlus ? "var(--accent)" : "var(--border)"}` }} />
          : <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", border: `2px solid ${isPlus ? "var(--accent)" : "transparent"}` }}>{(user.displayName || "?")[0].toUpperCase()}</div>
        }
      </button>
      {/* Pastille de sync HORS du bouton (sinon le clip circulaire du ripple la masque). */}
      <span style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: syncColor, border: "2px solid var(--bg)", display: showDot ? "block" : "none", pointerEvents: "none" }} />
      {(open || closing) && createPortal(
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 1299 }} onClick={() => closeThen()} />
          <div ref={surfaceRef} onAnimationEnd={onAnimationEnd} style={{ position: "fixed", top: dropPos.top, right: dropPos.right, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 16px", zIndex: 1300, minWidth: 210, boxShadow: "0 8px 32px rgba(0,0,0,0.35)", animation: closing ? "collapseUp 0.16s ease forwards" : "expandDown 0.2s ease" }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 4 }}>{user.email}</div>
            {syncLabel && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: syncColor, marginBottom: 4 }}>{offline && <Icon name="wifiOff" size={12} color={syncColor} />}{syncLabel}</div>}
            <div style={{ height: 1, background: "var(--border)", margin: "8px -4px" }} />
            {isAdmin && (
              <button onClick={() => closeThen(() => navigate("/admin/dashboard"))}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text)", fontSize: 13, fontWeight: 600, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "opacity 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.opacity = "0.75"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(var(--admin-rgb),0.14)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <Icon name="terminal" size={13} color="var(--admin)" />
                </span> Console admin
              </button>
            )}
            <button onClick={() => closeThen(() => navigate("/profile"))}
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
            <button onClick={() => closeThen(() => window.dispatchEvent(new Event("mijote:show-onboarding")))}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="sparkle" size={13} color="currentColor" /> Revoir l'introduction
            </button>
            <button onClick={() => closeThen(() => setAbout(true))}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="info" size={13} color="currentColor" /> À propos
            </button>
            <button onClick={() => closeThen(() => navigate("/legal"))}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", background: "none", border: "none", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="fileText" size={13} color="currentColor" /> Informations légales
            </button>
            <a href={CONTACT_MAILTO} onClick={() => closeThen()}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "8px 4px", color: "var(--text3)", fontSize: 13, fontFamily: "var(--ff-body)", textDecoration: "none", cursor: "pointer", transition: "color 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}>
              <Icon name="mail" size={13} color="currentColor" /> Nous contacter
            </a>
            <div style={{ height: 1, background: "var(--border)", margin: "8px -4px" }} />
            <button onClick={() => closeThen(() => setConfirmSignOut(true))}
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
            // onSignOut() change l'etat d'auth et demonte aussitot cette modal :
            // attendre en parallele ne montre donc rien. On laisse le spinner tourner
            // ~1000 ms AVANT de declencher la deconnexion pour qu'il soit bien visible.
            await new Promise(r => setTimeout(r, 1000));
            try { await onSignOut(); }
            catch { setSigningOut(false); }
          }}>
          Tes recettes restent synchronisées. Tu pourras te reconnecter à tout moment.
        </ConfirmDialog>
      )}
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  );
}
