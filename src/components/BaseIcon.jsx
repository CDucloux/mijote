// Icône des préparations de base : une louche (bol circulaire + manche).
// Composant unique réutilisé partout où une « base » est représentée.
export const BaseIcon = ({ size = 20, color = "var(--accent)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8.5" cy="11.5" r="4.5" />
    <line x1="12.5" y1="8.2" x2="20.5" y2="3.5" />
  </svg>
);
