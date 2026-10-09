import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../ui/Icon.jsx";
import { IconChip } from "../ui/primitives.jsx";
import { useModalExit } from "../../hooks/useModalExit.js";

/** Résultat d'un import (ou d'une saisie refusée) à présenter à l'admin. */
export interface ImportResult {
  ok: boolean;
  title: string;
  message: string;
  /** Détail ligne à ligne (erreurs de validation), affiché en liste défilante. */
  details?: string[];
}

interface ImportResultDialogProps extends ImportResult {
  onClose: () => void;
}

// Popup de résultat d'import de la console : succès (créés / mis à jour) ou
// annulation avec la liste COMPLÈTE des erreurs, au lieu d'une ligne de statut
// tronquée sous la zone de dépose. Même dialogue centré que les confirmations.
export function ImportResultDialog({ ok, title, message, details = [], onClose }: ImportResultDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit<HTMLDivElement>(onClose);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const accent = ok ? "var(--accent)" : "var(--red)";

  return createPortal(
    <div className={`alert-backdrop${closing ? " is-closing" : ""}`} onClick={() => beginClose()}>
      <div ref={surfaceRef} className={`alert-dialog${closing ? " is-closing" : ""}`} role="alertdialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()} onAnimationEnd={onAnimationEnd}>
        <IconChip size={52} radius="50%" tint={ok ? "rgba(var(--accent-rgb),0.12)" : "rgba(var(--red-rgb),0.12)"} style={{ margin: "0 auto 14px" }}>
          <Icon name={ok ? "check" : "warning"} size={24} color={accent} />
        </IconChip>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, textAlign: "center" }}>{title}</h3>
        <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.55, textAlign: "center", margin: 0 }}>{message}</p>
        {details.length > 0 && (
          <ul style={{ listStyle: "none", margin: "16px 0 0", padding: "4px 14px", maxHeight: "38vh", overflowY: "auto", borderRadius: 12, background: "var(--surface2)", textAlign: "left" }}>
            {details.map((line, i) => (
              <li key={i} style={{ fontSize: 13, lineHeight: 1.45, color: "var(--text)", padding: "9px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>{line}</li>
            ))}
          </ul>
        )}
        <button ref={closeRef} className="btn btn-primary btn-pill" style={{ width: "100%", marginTop: 22, justifyContent: "center" }} onClick={() => beginClose()}>
          Compris
        </button>
      </div>
    </div>,
    document.body,
  );
}
