import { Icon } from "../Icon.jsx";
import { SwipeableSheet } from "../SwipeableSheet.jsx";

// Motifs de signalement d'une recette publique (modération).
const REPORT_REASONS = [
  { id: "copyright", label: "Droit d'auteur / plagiat" },
  { id: "photo", label: "Photo inappropriée" },
  { id: "offensive", label: "Contenu offensant ou dangereux" },
  { id: "spam", label: "Spam ou hors-sujet" },
  { id: "other", label: "Autre" },
];

/**
 * Feuille de signalement d'une recette publique (droit d'auteur, photo inappropriée…).
 * Le motif choisi et la note libre sont portés par le parent ; l'envoi effectif passe
 * par `onReport(reason, note)` une fois la feuille refermée.
 */
export function ReportSheet({ reportReason, setReportReason, reportNote, setReportNote, onClose, onReport }) {
  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (<>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: "rgba(224,82,82,0.14)", display: "grid", placeItems: "center" }}><Icon name="flag" size={19} color="var(--red)" /></span>
          <div>
            <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 600, margin: 0 }}>Signaler cette recette</h3>
            <p style={{ fontSize: 12, color: "var(--text3)", margin: "2px 0 0" }}>Pourquoi ne respecte-t-elle pas les conditions ?</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "14px 0" }}>
          {REPORT_REASONS.map(r => {
            const on = reportReason === r.id;
            return (
              <button key={r.id} onClick={() => setReportReason(r.id)}
                style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 13, cursor: "pointer", textAlign: "left",
                  background: on ? "rgba(224,82,82,0.08)" : "var(--surface2)", border: `1px solid ${on ? "rgba(224,82,82,0.45)" : "var(--border)"}` }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", border: `2px solid ${on ? "var(--red)" : "var(--border)"}`, background: on ? "var(--red)" : "transparent" }}>
                  {on && <Icon name="check" size={11} color="#fff" />}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{r.label}</span>
              </button>
            );
          })}
        </div>
        <textarea value={reportNote} onChange={e => setReportNote(e.target.value)} rows={2} maxLength={400}
          placeholder="Précisions (optionnel)…" className="field-input" style={{ resize: "none", marginBottom: 14 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-pill" style={{ flex: 1 }} onClick={() => close()}>Annuler</button>
          <button className="btn btn-danger btn-pill" style={{ flex: 1.3 }} disabled={!reportReason}
            onClick={() => close(() => { onClose(); onReport?.(reportReason, reportNote.trim()); })}>
            <Icon name="flag" size={14} /> Envoyer le signalement
          </button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
