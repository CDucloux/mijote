import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../ui/Icon.jsx";

// Bouton rond d'action (modifier / supprimer) des cartes de la console : le survol
// desktop vient des classes `.icon-btn-soft` / `.icon-btn-danger` (global.css).
const ROUND_ICON_BTN: CSSProperties = { width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", border: "none", background: "transparent", color: "var(--text3)", cursor: "pointer" };

/**
 * Repli animé dans les DEUX sens (ouverture ET fermeture) sans mesurer la
 * hauteur : la piste de grille passe de 0fr à 1fr, le wrapper `overflow: hidden`
 * clippe pendant l'animation. Le contenu reste monté (sinon la fermeture ne
 * pourrait pas s'animer, le démontage étant instantané). Même idiome que
 * RecipeFilterSheet.
 */
export function AdminCollapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", transition: "grid-template-rows 0.28s cubic-bezier(0.33, 1, 0.68, 1)" }}>
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}

/** Chevron rond d'un groupe repliable, tourné selon l'état. */
export function CollapseChevron({ open }: { open: boolean }) {
  return (
    <span className="icon-btn-soft" style={{
      display: "flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
      background: "var(--surface2)", border: "1px solid var(--border)",
      transition: "transform 0.25s ease, background-color 0.18s ease, color 0.18s ease", transform: open ? "rotate(-90deg)" : "rotate(90deg)",
    }}>
      <Icon name="forward" size={12} color="var(--text3)" />
    </span>
  );
}

/** Pastille « Master » : entrée de la base partagée, en lecture seule. */
export function MasterBadge() {
  return <span style={{ fontSize: 10, color: "rgba(155,135,245,1)", fontWeight: 600, padding: "2px 8px", background: "rgba(155,135,245,0.14)", border: "1px solid rgba(155,135,245,0.35)", borderRadius: 8, flexShrink: 0 }}>Master</span>;
}

/** Paire de boutons ronds modifier / supprimer d'une entrée. */
export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <>
      <button className="icon-btn-soft ripple" onClick={onEdit} title="Modifier" style={ROUND_ICON_BTN}><Icon name="edit" size={14} /></button>
      <button className="icon-btn-danger ripple" onClick={onDelete} title="Supprimer" style={ROUND_ICON_BTN}><Icon name="trash" size={14} /></button>
    </>
  );
}

/** Pilule « + Ajouter » d'un en-tête de groupe. */
export function AddPill({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn btn-primary" style={{ flexShrink: 0, padding: "6px 14px", fontSize: 11, borderRadius: 999 }} onClick={onClick}>
      <Icon name="plus" size={12} /> Ajouter
    </button>
  );
}
