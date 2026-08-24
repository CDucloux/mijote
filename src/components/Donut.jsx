export const Donut = ({ segments, size = 130, stroke = 18, centerLabel, centerSub }) => {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const frac = seg.value / total;
          const dash = frac * circ;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-acc * circ}
              style={{ transition: "stroke-dasharray 0.5s ease" }} />
          );
          acc += frac;
          return el;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 600, lineHeight: 1 }}>{centerLabel}</span>
        {centerSub && <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 3 }}>{centerSub}</span>}
      </div>
    </div>
  );
};
