import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../ui/Icon.jsx";
import { IconChip } from "../ui/primitives.jsx";
import { useModalExit } from "../../hooks/useModalExit.js";
import type { ImportReport } from "@/lib/household/importMerge.js";

/** Résultat d'un import (ou d'une saisie refusée) à présenter à l'admin. */
export interface ImportResult {
  ok: boolean;
  title: string;
  message: string;
  /** Détail ligne à ligne (erreurs de validation), affiché en liste défilante. */
  details?: string[];
  /** Bilan d'un import réussi : ce qui a été créé, modifié, laissé tel quel. */
  report?: ImportReport;
}

interface ImportResultDialogProps extends ImportResult {
  onClose: () => void;
}

const CREATED = "var(--accent)";
const UPDATED = "rgba(var(--accent-rgb),0.45)";
const UNCHANGED = "var(--surface3)";

const LIST: CSSProperties = { listStyle: "none", margin: "18px 0 0", padding: "2px 14px", maxHeight: "34vh", overflowY: "auto", borderRadius: 14, background: "var(--surface2)" };

// Répartition de l'import sur une barre : chaque segment pèse sa part des lignes lues.
function ReportBar({ report }: { report: ImportReport }) {
  const parts = [
    { n: report.created.length, color: CREATED, label: report.created.length > 1 ? "nouveaux" : "nouveau" },
    { n: report.updated.length, color: UPDATED, label: report.updated.length > 1 ? "modifiés" : "modifié" },
    { n: report.unchanged, color: UNCHANGED, label: "déjà à jour" },
  ].filter(p => p.n > 0);
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", gap: 2, height: 6 }} aria-hidden="true">
        {parts.map((p, i) => (
          <span key={i} className="import-bar-seg" style={{ flexGrow: p.n, flexBasis: 6, borderRadius: 999, background: p.color, animationDelay: `${i * 90}ms` }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 9 }}>
        {parts.map((p, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text2)", fontVariantNumeric: "tabular-nums" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.color }} />
            <b style={{ fontWeight: 650, color: "var(--text)" }}>{p.n}</b> {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// Popup de résultat d'import de la console : bilan réel (ce qui a changé d'abord,
// nommé ligne à ligne) ou annulation avec la liste COMPLÈTE des erreurs.
export function ImportResultDialog({ ok, title, message, details = [], report, onClose }: ImportResultDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit<HTMLDivElement>(onClose);
  useEffect(() => { closeRef.current?.focus(); }, []);
  const accent = ok ? "var(--accent)" : "var(--red)";
  const changes = report ? [
    ...report.created.map(name => ({ name, created: true })),
    ...report.updated.map(name => ({ name, created: false })),
  ] : [];

  return createPortal(
    <div className={`alert-backdrop${closing ? " is-closing" : ""}`} onClick={() => beginClose()}>
      <div ref={surfaceRef} className={`alert-dialog${closing ? " is-closing" : ""}`} role="alertdialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()} onAnimationEnd={onAnimationEnd}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <IconChip size={34} radius="50%" tint={ok ? "rgba(var(--accent-rgb),0.12)" : "rgba(var(--red-rgb),0.12)"}>
            <Icon name={ok ? "check" : "warning"} size={17} color={accent} />
          </IconChip>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: accent }}>{ok ? "Import terminé" : "Import refusé"}</span>
        </div>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2, margin: "0 0 6px", color: "var(--text)" }}>{title}</h3>
        <p style={{ color: "var(--text2)", fontSize: 14, lineHeight: 1.55, margin: 0 }}>{message}</p>

        {report && report.read > report.unchanged && <ReportBar report={report} />}

        {changes.length > 0 && (
          <ul style={LIST} aria-label="Ce qui a changé">
            {changes.map((c, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                <span style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999,
                  color: c.created ? "#fff" : "var(--text)", background: c.created ? CREATED : UPDATED }}>
                  {c.created ? "Nouveau" : "Modifié"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {details.length > 0 && (
          <ul style={LIST}>
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
