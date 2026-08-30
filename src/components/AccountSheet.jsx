import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useModalExit } from "../hooks/useModalExit.js";
import { spawnRipple } from "@/lib/ui/ripple.js";

/**
 * Panneau « compte » plein écran des apps mobiles (Capacitor / PWA installée) :
 * ouvert depuis l'avatar, il glisse de la droite vers la gauche (standard natif)
 * plutôt que de dérouler un dropdown comme sur desktop.
 *
 * Les actions sont fournies par {@link UserAvatar} (source unique, partagée avec
 * le dropdown web) ; chaque rangée rejoue la sortie animée avant d'exécuter son
 * action, sauf celles marquées `keepsOpen` (ex. bascule de thème) qui agissent
 * sur place.
 *
 * @param props.user - Utilisateur connecté (photo, nom, e-mail).
 * @param props.isPlus - Abonné Cardamome+ (anneau accent sur l'avatar).
 * @param props.syncLabel - Libellé de synchro à afficher, ou `null`.
 * @param props.syncColor - Couleur associée à l'état de synchro.
 * @param props.offline - Hors ligne (ajoute l'icône wifi barré).
 * @param props.actions - Rangées d'action `{ icon, label, onClick|href, variant, keepsOpen }`.
 * @param props.signOutAction - Action de déconnexion (rangée détachée en bas).
 * @param props.onClose - Fermeture réelle, appelée en fin d'animation de sortie.
 */
export function AccountSheet({ user, isPlus, syncLabel, syncColor, offline, actions, signOutAction, onClose }) {
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit(onClose);
  // beginClose(cb) n'appelle PAS onClose de lui-même : on l'enchaîne ici pour
  // que la rangée ferme le drawer PUIS exécute son action une fois la sortie jouée.
  const closeThen = (fn) => beginClose(() => { onClose(); fn?.(); });
  const runRow = (action) => action.keepsOpen ? action.onClick?.() : closeThen(action.onClick);
  const firstName = (user.displayName || user.email || "").split(/[ @]/)[0];

  const rowContent = (action, danger) => (
    <>
      <span className="account-row-icon" style={{ color: danger ? "var(--red)" : action.variant === "admin" ? "var(--accent)" : "var(--text2)" }}>
        <Icon name={action.icon} size={19} color="currentColor" />
      </span>
      {action.label}
    </>
  );

  return createPortal(
    <div className={`account-drawer-backdrop${closing ? " is-closing" : ""}`} onClick={() => beginClose()}>
      <aside ref={surfaceRef} className={`account-drawer${closing ? " is-closing" : ""}`} onClick={e => e.stopPropagation()} onAnimationEnd={onAnimationEnd}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 12px 18px" }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
          <button className="ripple ripple-light" onClick={() => beginClose()} aria-label="Fermer"
            style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", border: "none", background: "none", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Icon name="close" size={22} color="var(--text2)" />
          </button>
        </header>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "6px 20px 22px" }}>
          {user.photoURL
            ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 76, height: 76, borderRadius: "50%", display: "block", border: `2.5px solid ${isPlus ? "var(--accent)" : "var(--border)"}` }} />
            : <div style={{ width: 76, height: 76, borderRadius: "50%", background: "var(--accent)", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 600, color: "#fff", border: `2.5px solid ${isPlus ? "var(--accent)" : "transparent"}` }}>{(user.displayName || "?")[0].toUpperCase()}</div>}
          <div style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", textAlign: "center" }}>Bonjour {firstName}</div>
          {syncLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: syncColor }}>
              {offline && <Icon name="wifiOff" size={13} color={syncColor} />}{syncLabel}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 12px 16px", display: "flex", flexDirection: "column" }}>
          {actions.map((action, i) => (
            action.href
              ? <a key={i} className="menu-row" href={action.href} onPointerDown={spawnRipple} onClick={() => closeThen()} style={{ textDecoration: "none" }}>{rowContent(action, false)}</a>
              : <button key={i} className="menu-row" onPointerDown={spawnRipple} onClick={() => runRow(action)}>{rowContent(action, false)}</button>
          ))}
          <button className="menu-row menu-row-danger" style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 15 }}
            onPointerDown={spawnRipple} onClick={() => closeThen(signOutAction.onClick)}>
            {rowContent(signOutAction, true)}
          </button>
        </div>
      </aside>
    </div>,
    document.body
  );
}
