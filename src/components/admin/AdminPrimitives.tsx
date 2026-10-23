import { Icon } from "../ui/Icon.jsx";

/** Pastille « Master » : entrée de la base partagée, en lecture seule. */
export function MasterBadge() {
  return <span style={{ fontSize: 10, color: "rgba(155,135,245,1)", fontWeight: 600, padding: "2px 8px", background: "rgba(155,135,245,0.14)", borderRadius: 8, flexShrink: 0, alignSelf: "center" }}>Master</span>;
}

/** Bouton rond « Supprimer » du pied d'un éditeur, à gauche d'Annuler / Sauvegarder. */
export function SheetDeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-btn-danger ripple" onClick={onClick} title="Supprimer" aria-label="Supprimer"
      style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center", border: "none", background: "var(--surface2)", cursor: "pointer" }}>
      <Icon name="trash" size={17} />
    </button>
  );
}
