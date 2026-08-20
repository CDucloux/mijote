import { Icon } from "../Icon.jsx";

/**
 * En-tête d'un groupe de courses (catégorie ou « Acheté ») : icône, libellé,
 * pastille de compte, filet, et une action optionnelle collée à droite (le
 * bouton « Valider l'achat » de la section « Acheté »).
 */
export function ShoppingGroupHeader({ icon, label, count, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "14px 2px 8px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text3)" }}>
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      <span>{label}</span>
      {count != null && <span style={{ fontSize: 10, background: "var(--surface3)", borderRadius: 10, padding: "1px 7px", color: "var(--text2)" }}>{count}</span>}
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      {action}
    </div>
  );
}

/** Pastille « Valider l'achat » (déversement des produits de placard dans le stock). */
export function ShoppingClearButton({ onClick, title }) {
  return (
    <button style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0, padding: "6px 14px", fontSize: 11.5, fontWeight: 600, borderRadius: 999, background: "rgba(var(--ok-rgb),0.14)", color: "var(--ok)", border: "1px solid rgba(var(--ok-rgb),0.35)", cursor: "pointer" }} onClick={onClick} title={title}>
      <Icon name="shopping" size={12} color="var(--ok)" /> Valider l'achat
    </button>
  );
}

/**
 * Rend une liste de courses déjà découpée en sections « à acheter » (par
 * catégorie) et articles « Acheté ». Présentationnel : le découpage vient de
 * `buildShoppingSections`, le rendu d'une ligne est fourni par `renderRow`, et
 * le bouton de validation par `clearButton` (absent si la liste le masque).
 */
export function ShoppingSectionList({ sections, done, renderRow, clearButton }) {
  return (
    <>
      {sections.map(sec => (
        <div key={sec.key}>
          <ShoppingGroupHeader icon={sec.icon} label={sec.label} count={sec.items.length} />
          {sec.items.map(renderRow)}
        </div>
      ))}
      {done.length > 0 && (
        <div>
          <ShoppingGroupHeader icon="✓" label="Acheté" count={done.length} action={clearButton} />
          {done.map(renderRow)}
        </div>
      )}
    </>
  );
}
