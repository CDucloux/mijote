import { HEAT_DIAL_NOTCHES, notchAngle, notchLabel, type NotchRange } from "@/lib/utensils/heatDial.js";

// ─── BOUTON DE PLAQUE ─────────────────────────────────────────────────────────
// Dessine la puissance conseillée comme un bouton de cuisson à 6 crans : les
// crans de la plage s'allument, une bande relie leurs bornes, et le repère du
// bouton tourne jusqu'au cran haut à l'ouverture (comme une main qui règle le feu).

const SIZE = 56;
const C = SIZE / 2;

function polar(radius: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [C + radius * Math.sin(rad), C - radius * Math.cos(rad)];
}

function arcPath(radius: number, fromDeg: number, toDeg: number): string {
  const [x0, y0] = polar(radius, fromDeg);
  const [x1, y1] = polar(radius, toDeg);
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

interface HeatKnobProps {
  notches: NotchRange;
  accent: string;
  size?: number;
}

export function HeatKnob({ notches, accent, size = 46 }: HeatKnobProps) {
  const crans = Array.from({ length: HEAT_DIAL_NOTCHES }, (_, i) => i + 1);
  const lit = (n: number) => n >= notches.from && n <= notches.to;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={notchLabel(notches)} style={{ flexShrink: 0, display: "block" }}>
      <path d={arcPath(24, notchAngle(1), notchAngle(HEAT_DIAL_NOTCHES))} fill="none" stroke="var(--border)" strokeWidth={2} strokeLinecap="round" />
      {notches.to > notches.from && (
        <path d={arcPath(24, notchAngle(notches.from), notchAngle(notches.to))} fill="none" stroke={accent} strokeOpacity={0.3} strokeWidth={5} strokeLinecap="round" />
      )}
      {crans.map(n => {
        const [x, y] = polar(24, notchAngle(n));
        return <circle key={n} cx={x} cy={y} r={lit(n) ? 2.6 : 1.6} fill={lit(n) ? accent : "var(--text3)"} opacity={lit(n) ? 1 : 0.45} />;
      })}
      <circle cx={C} cy={C} r={15} fill="var(--surface2)" stroke="var(--border)" strokeWidth={1} />
      {/* Moletage : le pointillé du bord fait lire un vrai bouton plutôt qu'un cercle. */}
      <circle cx={C} cy={C} r={12.5} fill="none" stroke="var(--border)" strokeWidth={1.5} strokeDasharray="1 2.2" />
      <g className="heat-knob-pointer" style={{ transform: `rotate(${notchAngle(notches.to)}deg)`, transformOrigin: `${C}px ${C}px` }}>
        <line x1={C} y1={C - 4} x2={C} y2={C - 11} stroke={accent} strokeWidth={3} strokeLinecap="round" />
      </g>
    </svg>
  );
}
