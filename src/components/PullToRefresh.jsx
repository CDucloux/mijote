import { usePullToRefresh } from "../hooks/usePullToRefresh.js";

export function PullToRefresh({ enabled, onRefresh, children, threshold = 110 }) {
  const { containerRef, pull, refreshing } = usePullToRefresh(onRefresh, { enabled, threshold });
  const active = pull > 0 || refreshing;
  const ready = pull >= threshold;
  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {enabled && active && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: refreshing ? threshold : pull, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface2)", border: "1px solid var(--border)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)", opacity: Math.min(1, pull / threshold) }}>
            {refreshing
              ? <div style={{ width: 16, height: 16, border: "2px solid var(--accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              : <span style={{ fontSize: 16, lineHeight: 1, color: "var(--accent)", transition: "transform 0.18s", transform: `rotate(${ready ? 180 : 0}deg)` }}>↓</span>}
          </div>
        </div>
      )}
      <div style={{
        flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
        transform: active ? `translateY(${refreshing ? threshold : pull}px)` : "none",
        transition: pull > 0 && !refreshing ? "none" : "transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)",
      }}>
        {children}
      </div>
    </div>
  );
}
