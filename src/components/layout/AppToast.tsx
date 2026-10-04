import { Icon, type IconName } from "../ui/Icon.jsx";

/** Notification affichée (cf. useNotifications). */
interface ToastNotification {
  msg: string;
  type?: string;
}

interface AppToastProps {
  notification: ToastNotification;
  /** Sortie en cours : joue l'animation de disparition. */
  leaving: boolean;
  isDesktop: boolean;
}

const TONE: Record<string, { bg: string; icon: IconName }> = {
  error: { bg: "var(--red)", icon: "close" },
  warning: { bg: "#e8920a", icon: "warning" },
  info: { bg: "#4a90d9", icon: "forward" },
};
const OK: { bg: string; icon: IconName } = { bg: "var(--ok)", icon: "check" };

/** Toast global : en haut sur desktop, au-dessus de la tab bar sur mobile. */
export function AppToast({ notification, leaving, isDesktop }: AppToastProps) {
  const tone = TONE[notification.type ?? ""] ?? OK;
  const animation = leaving
    ? (isDesktop ? "toastOut 0.24s ease-in both" : "toastDown 0.24s cubic-bezier(0.4,0,1,1) both")
    : `${isDesktop ? "toastIn" : "toastUp"} 0.22s cubic-bezier(0.25,0.46,0.45,0.94) both`;
  return (
    <div style={{ position: "fixed", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 999, pointerEvents: "none",
      ...(isDesktop ? { top: 16 } : { bottom: "calc(var(--tab-h) + env(safe-area-inset-bottom) + 12px)" }) }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, maxWidth: "calc(100vw - 32px)", background: tone.bg, color: "#fff", padding: "10px 18px 10px 12px", borderRadius: 30, fontSize: 13, fontWeight: 500, boxShadow: "0 4px 20px rgba(0,0,0,0.35)", whiteSpace: "nowrap", animation }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name={tone.icon} size={12} color="#fff" />
        </div>
        {notification.msg}
      </div>
    </div>
  );
}
