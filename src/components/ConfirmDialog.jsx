import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon.jsx";
import { useModalExit } from "../hooks/useModalExit.js";
import { Row, IconChip } from "./ui/primitives.jsx";

// ─── DIALOGUE DE CONFIRMATION (alerte centrée) ────────────────────────────────
// Pour les actions destructives / irréversibles. Volontairement PAS une feuille
// swipeable : une suppression demande une décision (dialogue modal centré,
// focus sur « Annuler », Échap/clic sur le fond pour annuler) plutôt qu'un tiroir
// qu'on balaie machinalement. Pastille colorée + icône, titre + message centrés,
// Annuler / action. Gère un état `busy` (boutons désactivés, fermeture bloquée).
//
// tone : "danger" (rouge, défaut) pour supprimer ; "accent" (orange) pour une
// confirmation forte non destructive.
export function ConfirmDialog({
  title, children, icon = "trash",
  confirmLabel = "Supprimer", busyLabel = "Suppression…",
  tone = "danger", busy = false, onCancel, onConfirm, zIndex,
}) {
  const cancelRef = useRef(null);
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit(onCancel, { disabled: busy });
  useEffect(() => { cancelRef.current?.focus(); }, []);

  const accent = tone === "danger" ? "var(--red)" : "var(--accent)";
  const accentSoft = tone === "danger" ? "rgba(224,82,82,0.12)" : "rgba(232,112,58,0.12)";

  return createPortal(
    <div className={`alert-backdrop${closing ? " is-closing" : ""}`} onClick={busy ? undefined : () => beginClose()} style={zIndex != null ? { zIndex } : undefined}>
      <div ref={surfaceRef} className={`alert-dialog${closing ? " is-closing" : ""}`} role="alertdialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} onAnimationEnd={onAnimationEnd}>
        <IconChip size={52} radius="50%" tint={accentSoft} style={{ margin: "0 auto 14px" }}>
          <Icon name={icon} size={24} color={accent} />
        </IconChip>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>{title}</h3>
        <div style={{ color: "var(--text2)", fontSize: 14, marginBottom: 22, lineHeight: 1.55, textAlign: "center" }}>{children}</div>
        <Row gap={10}>
          <button ref={cancelRef} className="btn btn-ghost" style={{ flex: 1 }} disabled={busy} onClick={() => beginClose()}>Annuler</button>
          <button className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`} style={{ flex: 1 }} disabled={busy} onClick={onConfirm}>{busy ? busyLabel : confirmLabel}</button>
        </Row>
      </div>
    </div>,
    document.body
  );
}
