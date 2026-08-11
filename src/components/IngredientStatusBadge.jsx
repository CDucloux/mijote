import { Icon } from "./Icon.jsx";

/**
 * Pastille de statut d'un ingrédient, posée en BAS-DROITE de son image ronde.
 * Le conteneur de l'image doit être `position: relative`.
 * - validé → cercle vert + coche blanche
 * - en cours → cercle ambre + crayon
 *
 * @param status - `"validated"` ou autre (« en cours de rédaction »).
 * @param size - Diamètre de la pastille (px).
 * @param ring - Couleur du liseré (raccord au fond derrière l'image).
 * @param onClick - Si fourni, la pastille devient un BOUTON cliquable (ex. changer le statut).
 */
export function IngredientStatusBadge({ status, size = 18, ring = "var(--surface)", onClick }) {
  const validated = status === "validated";
  const Tag = onClick ? "button" : "span";
  return (
    <Tag onClick={onClick} title={validated ? "Validé" : "En cours de rédaction"}
      style={{
        position: "absolute", right: -2, bottom: -2, width: size, height: size, borderRadius: "50%",
        background: validated ? "var(--green)" : "#e8920a", border: `2px solid ${ring}`,
        display: "grid", placeItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
        ...(onClick && { cursor: "pointer", padding: 0, zIndex: 2 }),
      }}>
      <Icon name={validated ? "check" : "edit"} size={Math.round(size * 0.5)} color="#fff" />
    </Tag>
  );
}
