import { Icon } from "./Icon.jsx";

/**
 * Bascule clair / sombre à icône (soleil / lune), partagée entre la landing et
 * l'écran de connexion pour ne pas dupliquer le contrôle. Le style (position,
 * fond, taille) reste porté par la classe du contexte appelant, passée en
 * `className` : le composant n'apporte que le comportement et l'icône cohérente.
 */
export function ThemeToggle({ isDark, onToggle, className, size = 17 }) {
  return (
    <button
      type="button"
      className={className}
      onClick={onToggle}
      aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
    >
      <Icon name={isDark ? "sun" : "moon"} size={size} />
    </button>
  );
}
