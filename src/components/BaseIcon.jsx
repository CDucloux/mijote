export const BaseIcon = ({ size = 20, color = "var(--accent)" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8h12l-1.5 9H7.5L6 8Z" />
    <line x1="5" y1="8" x2="19" y2="8" />
    <path d="M6 10H3.5a1.5 1.5 0 0 0 0 3H6" />
    <path d="M18 10h2.5a1.5 1.5 0 0 1 0 3H18" />
    <path d="M10 5c0-1 1-1 1-2" />
    <path d="M14 5c0-1 1-1 1-2" />
  </svg>
);
