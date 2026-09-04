import { usePullToRefresh } from "../hooks/usePullToRefresh.js";
import { Icon } from "./Icon.jsx";

/** Position de repos du cercle pendant le refresh (px depuis le haut). */
const REST_Y = 64;
/** Rotation totale (deg) balayée par la flèche entre repos et seuil atteint. */
const MAX_SPIN = 270;

export function PullToRefresh({ enabled, onRefresh, children, threshold = 110 }) {
  const { containerRef, pull, refreshing } = usePullToRefresh(onRefresh, { enabled, threshold });
  const active = pull > 0 || refreshing;
  const progress = Math.min(1, pull / threshold);
  // Le contenu ne bouge plus : seul le cercle descend, en suivant le doigt puis
  // en se calant à REST_Y pendant le refresh.
  const y = refreshing ? REST_Y : pull;
  const gliding = refreshing || pull === 0; // release ou refresh → transition douce, sinon on colle au doigt

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", overscrollBehavior: "contain" }}>
      {enabled && active && (
        <div style={{
          position: "absolute", top: 0, left: "50%", zIndex: 5, pointerEvents: "none",
          transform: `translate(-50%, ${y}px)`,
          transition: gliding ? "transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)" : "none",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--surface2)", border: "1px solid var(--border)", boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
            opacity: refreshing ? 1 : progress,
            transform: `scale(${refreshing ? 1 : 0.6 + progress * 0.4})`,
          }}>
            {refreshing
              ? <Icon name="spinner" size={18} color="var(--accent)" weight="bold" style={{ animation: "spin 0.8s linear infinite" }} />
              : <Icon
                  name="refresh"
                  size={20}
                  color="var(--accent)"
                  weight="bold"
                  style={{ transform: `rotate(${progress * MAX_SPIN}deg)`, transition: gliding ? "transform 0.25s ease-out" : "none" }}
                />}
          </div>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
