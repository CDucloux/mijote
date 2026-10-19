import type { ReactNode } from "react";
import { usePullToRefresh } from "../../hooks/usePullToRefresh.js";
import { pullIndicatorFrame, PULL_ARC_CIRCUMFERENCE, PULL_ARC_RADIUS, PULL_HEAD_PATH } from "@/lib/ui/pullIndicator.js";

/** Position de repos du disque pendant le refresh (px depuis le haut). */
const REST_Y = 64;
/** Arc qui tourne pendant l'actualisation (part du cercle). */
const SPIN_ARC = 0.28;

interface PullToRefreshProps {
  enabled: boolean;
  onRefresh: () => unknown;
  children?: ReactNode;
  threshold?: number;
}

export function PullToRefresh({ enabled, onRefresh, children, threshold = 110 }: PullToRefreshProps) {
  const { containerRef, pull, refreshing } = usePullToRefresh<HTMLDivElement>(onRefresh, { enabled, threshold });
  const active = pull > 0 || refreshing;
  const progress = Math.min(1, pull / threshold);
  const frame = pullIndicatorFrame(progress);
  // Le contenu ne bouge pas : seul le disque descend, en suivant le doigt puis
  // en se calant à REST_Y pendant le refresh.
  const y = refreshing ? REST_Y : pull;
  const gliding = refreshing || pull === 0; // release ou refresh -> transition douce, sinon on colle au doigt
  const state = refreshing ? "refreshing" : frame.armed ? "armed" : "pulling";

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", overscrollBehavior: "contain" }}>
      {enabled && active && (
        <div
          className="ptr"
          style={{
            transform: `translate(-50%, ${y}px)`,
            transition: gliding ? "transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)" : "none",
          }}>
          <div
            className="ptr-disc"
            data-state={state}
            role={refreshing ? "status" : undefined}
            aria-label={refreshing ? "Actualisation…" : undefined}
            style={{ opacity: refreshing ? 1 : Math.min(1, progress * 2.2), ["--ptr-scale" as string]: refreshing ? 1 : 0.7 + progress * 0.3 }}>
            {refreshing ? (
              <svg className="ptr-svg ptr-spin" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r={PULL_ARC_RADIUS} className="ptr-arc"
                  strokeDasharray={`${SPIN_ARC * PULL_ARC_CIRCUMFERENCE} ${PULL_ARC_CIRCUMFERENCE}`} />
              </svg>
            ) : (
              <svg className="ptr-svg" viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${frame.rotation}deg)` }}>
                <circle cx="12" cy="12" r={PULL_ARC_RADIUS} className="ptr-arc" transform="rotate(-90 12 12)"
                  strokeDasharray={`${frame.dash} ${PULL_ARC_CIRCUMFERENCE}`} />
                <path className="ptr-head" d={PULL_HEAD_PATH}
                  transform={`translate(${frame.head.x} ${frame.head.y}) rotate(${frame.head.angle}) scale(${frame.head.scale})`} />
              </svg>
            )}
          </div>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}
