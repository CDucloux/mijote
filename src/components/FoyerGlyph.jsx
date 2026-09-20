// ─── PICTOGRAMME FOYER (maison + deux visages) ───────────────────────────────
// Glyphe maison propre à Cardamome : un toit, deux têtes et deux épaules, pour dire
// « un lieu, plusieurs personnes ». Couleur paramétrable (blanc sur fond accent,
// accent sur fond clair, etc.). Trait unique, cohérent avec le reste de l'UI.

/**
 * @param {{ size?: number, color?: string }} props
 * @param props.size - Côté du carré (px).
 * @param props.color - Couleur du trait/des visages (défaut : couleur courante héritée).
 */
export function FoyerGlyph({ size = 26, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.2 10.4 12 3.5l8.8 6.9" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.2" cy="12.4" r="1.9" fill={color} />
      <circle cx="14.8" cy="12.4" r="1.9" fill={color} />
      <path d="M5.7 19.2c.4-2 1.8-3 3.5-3s3.1 1 3.5 3M11.3 19.2c.4-2 1.8-3 3.5-3 1.6 0 3 1 3.5 3" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
