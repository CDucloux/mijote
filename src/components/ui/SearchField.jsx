import { Icon } from "./Icon.jsx";

// ─── CHAMP DE RECHERCHE STANDARD ─────────────────────────────────────────────
// Aligné sur la barre de recherche de l'appli (Accueil, Recettes…) : loupe à
// gauche, `enterKeyHint="search"` (→ touche « loupe » sur le clavier mobile),
// Entrée referme le clavier (blur), bouton d'effacement quand il y a du texte.

/**
 * @param value - Texte courant.
 * @param onChange - Rappelé avec la nouvelle valeur.
 * @param placeholder - Texte indicatif.
 * @param autoFocus - Focus au montage (défaut false).
 * @param style - Styles additionnels du wrapper.
 */
export function SearchField({ value, onChange, placeholder = "Rechercher…", autoFocus = false, style }) {
  return (
    <div style={{ position: "relative", ...style }}>
      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", pointerEvents: "none" }}>
        <Icon name="search" size={16} color="var(--text3)" />
      </span>
      <input
        className="field-input recipe-search"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
        style={{ paddingLeft: 42, paddingRight: value ? 40 : 16, background: "var(--surface)", borderRadius: 13, height: 46 }}
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Effacer la recherche" className="search-clear-btn" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
          <Icon name="close" size={13} />
        </button>
      )}
    </div>
  );
}
