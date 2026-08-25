/**
 * Gousse de cardamome dessinée (le mot-symbole de la marque), placée à gauche du
 * mot « Cardamome ». Partagée entre la landing et l'écran de connexion. Purement
 * décorative ; les couleurs suivent les tokens globaux (--accent2 / --accent-strong),
 * donc le thème clair/sombre est respecté partout.
 */
export function LogoPod({ size = 27 }) {
  return (
    <svg className="lp-pod" viewBox="15 15 70 70" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M50 15 C68 30 74 48 67 63 C62.5 74 55.5 80 50 85 C44.5 80 37.5 74 33 63 C26 48 32 30 50 15 Z" fill="var(--accent2)" />
      <g stroke="var(--accent-strong)" strokeLinecap="round">
        <path d="M50 24 C50 40 50 62 50 77" strokeWidth="4" />
        <path d="M42 30 C39.5 45 41 60 47 74" strokeWidth="3.4" />
        <path d="M58 30 C60.5 45 59 60 53 74" strokeWidth="3.4" />
      </g>
    </svg>
  );
}
