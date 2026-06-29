// Icône des préparations de base : une louche (demi-cercle bowl + manche).
// Composant unique réutilisé partout où une « base » est représentée.
export const BaseIcon = ({ size = 20, color = "var(--accent)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 11a5 5 0 0 0 10 0Z" />
    <path d="M14.5 11 19 4.5" />
  </svg>
);
