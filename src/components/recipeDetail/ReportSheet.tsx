import { Icon } from "../ui/Icon.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";

// Motifs de signalement d'une recette publique (modération), avec un exemple concret
// pour lever l'hésitation entre deux motifs voisins.
const REPORT_REASONS = [
  { id: "copyright", label: "Droit d'auteur ou plagiat", hint: "Recette ou photo reprise sans l'accord de son auteur" },
  { id: "photo", label: "Photo inappropriée", hint: "Image choquante, trompeuse ou sans rapport avec le plat" },
  { id: "offensive", label: "Contenu offensant ou dangereux", hint: "Propos haineux, pratique risquée pour la santé" },
  { id: "spam", label: "Spam ou hors-sujet", hint: "Publicité, liens douteux, ce n'est pas une recette" },
  { id: "other", label: "Autre chose", hint: "Explique-nous en quelques mots juste en dessous" },
];

/**
 * Feuille de signalement d'une recette publique (droit d'auteur, photo inappropriée…).
 * Le motif choisi et la note libre sont portés par le parent ; l'envoi effectif passe
 * par `onReport(reason, note)` une fois la feuille refermée.
 */
interface ReportSheetProps {
  reportReason: string | null;
  setReportReason: (reason: string) => void;
  reportNote: string;
  setReportNote: (note: string) => void;
  onClose: () => void;
  onReport?: (reason: string | null, note: string) => void;
}

export function ReportSheet({ reportReason, setReportReason, reportNote, setReportNote, onClose, onReport }: ReportSheetProps) {
  return (
    <SwipeableSheet onClose={onClose}>
      {(close) => (<>
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Signaler cette recette</h3>
        <p style={{ fontSize: 13, color: "var(--text3)", margin: "4px 0 16px" }}>Qu'est-ce qui pose problème ?</p>

        {/* Liste radio sans cartes : seule l'option choisie prend un fond. Marge négative
            pour aligner les pastilles radio sur le titre malgré le padding des lignes. */}
        <div role="radiogroup" aria-label="Motif du signalement" style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -12px 14px" }}>
          {REPORT_REASONS.map(r => {
            const on = reportReason === r.id;
            return (
              <button key={r.id} role="radio" aria-checked={on} className="ripple hover-neutral" onClick={() => setReportReason(r.id)}
                style={{ display: "flex", alignItems: "center", gap: 13, padding: "10px 12px", borderRadius: 14, border: "none", cursor: "pointer", textAlign: "left",
                  background: on ? "var(--surface2)" : "transparent", transition: "background-color 0.2s ease" }}>
                {/* Radio : l'anneau s'épaissit jusqu'à ne laisser qu'un point (transition de bordure). */}
                <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, boxSizing: "border-box",
                  border: on ? "6px solid var(--red)" : "1.5px solid var(--text3)", background: "var(--surface)",
                  transition: "border-width 0.18s cubic-bezier(0.34,1.56,0.64,1), border-color 0.18s ease" }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.3 }}>{r.label}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text3)", lineHeight: 1.4, marginTop: 1 }}>{r.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <textarea value={reportNote} onChange={e => setReportNote(e.target.value)} rows={2} maxLength={400}
          placeholder={reportReason === "other" ? "Dis-nous ce qui ne va pas…" : "Un détail qui nous aiderait ? (facultatif)"}
          className="field-input field-bare" style={{ resize: "none", borderRadius: 16, marginBottom: 18 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button className="btn btn-ghost btn-pill" style={{ background: "transparent", padding: "12px 18px" }} onClick={() => close()}>Annuler</button>
          <button className="btn btn-danger-solid btn-pill btn-flat" style={{ flex: 1, padding: "12px 18px" }} disabled={!reportReason}
            onClick={() => close(() => { onClose(); onReport?.(reportReason, reportNote.trim()); })}>
            <Icon name="flag" size={15} /> Envoyer le signalement
          </button>
        </div>
      </>)}
    </SwipeableSheet>
  );
}
