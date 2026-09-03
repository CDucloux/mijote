import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { spawnRipple } from "@/lib/ui/ripple.js";

const ENTER_TRANSITION = "transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)";

/**
 * Panneau « compte » plein écran des apps mobiles (Capacitor / PWA installée) :
 * ouvert depuis l'avatar, il glisse de la droite vers la gauche (standard natif)
 * plutôt que de dérouler un dropdown comme sur desktop, et se ferme aussi par un
 * swipe vers la droite.
 *
 * Les actions arrivent regroupées ({@link UserAvatar}, source unique partagée
 * avec le dropdown web) : chaque groupe forme une carte arrondie ; la console
 * admin a sa propre carte « spéciale », la déconnexion sa carte détachée.
 * Entrée, sortie et glissement sont pilotés par `transform` (pas de keyframe) pour
 * ne pas entrer en conflit avec le drag.
 *
 * @param props.user - Utilisateur connecté (photo, nom, e-mail).
 * @param props.isPlus - Abonné Cardamome+ (anneau accent sur l'avatar).
 * @param props.syncLabel - Libellé de synchro, ou `null`.
 * @param props.syncColor - Couleur de l'état de synchro.
 * @param props.offline - Hors ligne (ajoute l'icône wifi barré).
 * @param props.groups - Groupes d'actions `[{ special?, items: [{ icon, label, onClick|href, variant, keepsOpen }] }]`.
 * @param props.signOutAction - Action de déconnexion (carte détachée en bas).
 * @param props.onClose - Fermeture réelle, appelée en fin d'animation de sortie.
 */
export function AccountSheet({ user, isPlus, syncLabel, syncColor, offline, groups, signOutAction, onClose }) {
  const asideRef = useRef(null);
  const drag = useRef({ x: 0, y: 0, axis: null });
  const pending = useRef(null);
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragX, setDragX] = useState(null); // px pendant un swipe, sinon null
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const close = useCallback((fn) => {
    setClosing((c) => {
      if (!c) pending.current = typeof fn === "function" ? fn : null;
      return true;
    });
    setDragX(null);
    setDragging(false);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const onTransitionEnd = (e) => {
    if (e.target !== asideRef.current || e.propertyName !== "transform" || !closing) return;
    const fn = pending.current;
    pending.current = null;
    onClose();
    fn?.();
  };

  const runRow = (action) => action.keepsOpen ? action.onClick?.() : close(action.onClick);

  const onTouchStart = (e) => {
    if (e.touches.length !== 1 || closing) return;
    drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null };
  };
  const onTouchMove = (e) => {
    if (closing || drag.current.axis === "y") return;
    const dx = e.touches[0].clientX - drag.current.x;
    const dy = e.touches[0].clientY - drag.current.y;
    if (drag.current.axis === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drag.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (drag.current.axis === "y") return;
    }
    if (!dragging) setDragging(true);
    setDragX(Math.max(0, dx));
  };
  const onTouchEnd = () => {
    if (drag.current.axis !== "x") { drag.current.axis = null; return; }
    drag.current.axis = null;
    const width = asideRef.current?.offsetWidth || 360;
    setDragging(false);
    if ((dragX || 0) > Math.min(140, width * 0.3)) close();
    else setDragX(null);
  };

  const transform = closing ? "translateX(100%)"
    : dragX != null ? `translateX(${dragX}px)`
      : entered ? "translateX(0)" : "translateX(100%)";

  const row = (action, i) => {
    const danger = action.variant === "danger";
    const iconColor = danger ? "var(--red)" : action.variant === "admin" ? "var(--admin)" : "var(--text2)";
    const body = (
      <>
        <span className="account-row-icon" style={{ color: iconColor }}>
          <Icon name={action.icon} size={19} color="currentColor" />
        </span>
        {action.label}
      </>
    );
    const cls = `menu-row${danger ? " menu-row-danger" : ""}`;
    return action.href
      ? <a key={i} className={cls} href={action.href} onPointerDown={spawnRipple} onClick={() => close()} style={{ textDecoration: "none" }}>{body}</a>
      : <button key={i} className={cls} onPointerDown={spawnRipple} onClick={() => (danger ? close(action.onClick) : runRow(action))}>{body}</button>;
  };

  return createPortal(
    <div className={`account-drawer-backdrop${closing ? " is-closing" : ""}`} onClick={() => close()}>
      <aside ref={asideRef} className="account-drawer" onClick={(e) => e.stopPropagation()}
        onTransitionEnd={onTransitionEnd}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ transform, transition: dragging ? "none" : ENTER_TRANSITION }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "8px 8px 0" }}>
          <button className="ripple ripple-light" onClick={() => close()} aria-label="Fermer"
            style={{ flexShrink: 0, width: 40, height: 40, borderRadius: "50%", border: "none", background: "none", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Icon name="close" size={22} color="var(--text2)" />
          </button>
        </header>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "6px 20px 22px" }}>
          {user.photoURL
            ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" style={{ width: 76, height: 76, borderRadius: "50%", display: "block", border: `2.5px solid ${isPlus ? "var(--accent)" : "var(--border)"}` }} />
            : <div style={{ width: 76, height: 76, borderRadius: "50%", background: "var(--accent)", display: "grid", placeItems: "center", fontSize: 30, fontWeight: 600, color: "#fff", border: `2.5px solid ${isPlus ? "var(--accent)" : "transparent"}` }}>{(user.displayName || "?")[0].toUpperCase()}</div>}
          <div style={{ maxWidth: "100%", fontSize: 14.5, fontWeight: 500, color: "var(--text3)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
          {syncLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: syncColor }}>
              {offline && <Icon name="wifiOff" size={13} color={syncColor} />}{syncLabel}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 14px calc(20px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 12 }}>
          {groups.map((group, gi) => (
            <div key={gi} className={`account-group${group.special ? " is-special" : ""}`}>
              {group.items.map(row)}
            </div>
          ))}
          <div className="account-group is-danger">{row(signOutAction, "signout")}</div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
