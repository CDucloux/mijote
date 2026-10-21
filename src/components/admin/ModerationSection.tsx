import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../ui/Icon.jsx";
import { ConfirmDialog } from "../ui/ConfirmDialog.jsx";
import { EmptyArt } from "../ui/EmptyArt.jsx";
import { reportReasonLabel } from "../../constants/reportReasons.js";
import { groupReportsByRecipe } from "@/lib/household/masterDrafts.js";
import { DISCOVER_PREFIX } from "../../hooks/usePublicRecipeView.js";
import type { StoredReport } from "@/lib/firebase/community.js";
import type { useModerationReports } from "../../hooks/useModerationReports.js";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function ModerationEmpty() {
  return (
    <div className="slide-up notif-empty" style={{ minHeight: "46vh", justifyContent: "center" }}>
      <EmptyArt name="fanion" size={128} style={{ marginBottom: 8 }} />
      <h3 className="notif-empty-t">Aucun signalement</h3>
      <p className="notif-empty-s" style={{ maxWidth: 320 }}>La communauté n'a rien remonté. Les recettes signalées arriveront ici, regroupées par recette.</p>
    </div>
  );
}

// Un signalement : motif en pastille, date, note de l'auteur, rejet à droite.
function ReportRow({ report, busy, onDismiss }: { report: StoredReport; busy: boolean; onDismiss: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 12px", borderRadius: 14, background: "var(--surface2)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--red)" }}>{reportReasonLabel(report.reason)}</span>
          {report.createdAtMs != null && <span style={{ fontSize: 12, color: "var(--text3)" }}>{fmtDate(report.createdAtMs)}</span>}
        </div>
        {report.note && <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5, margin: "5px 0 0", wordBreak: "break-word", maxWidth: "65ch" }}>« {report.note} »</p>}
        {report.reporterEmail && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{report.reporterEmail}</div>}
      </div>
      <button onClick={onDismiss} disabled={busy} title="Rejeter ce signalement" className="pressable hover-neutral hover-text"
        style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 12px", borderRadius: 999, border: "none", fontSize: 12.5, fontWeight: 600, background: "var(--surface)", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
        <Icon name="close" size={12} color="currentColor" /> Rejeter
      </button>
    </div>
  );
}

type ModerationProps = ReturnType<typeof useModerationReports>;

/**
 * Section « Modération » : signalements regroupés par recette publique, rejet
 * signalement par signalement, ou retrait de la recette de la communauté.
 */
export function ModerationSection({ reports, busy, dismissReport, deleteReportedRecipe }: ModerationProps) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<{ pubId: string; name: string } | null>(null);
  const groups = groupReportsByRecipe(reports);
  if (!groups.length) return <ModerationEmpty />;
  const reportCount = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Volume en attente : l'élément dominant de la section. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "0 4px" }}>
        <span style={{ fontFamily: "var(--ff-display)", fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{groups.length}</span>
        <span style={{ fontSize: 14, color: "var(--text2)" }}>
          recette{groups.length > 1 ? "s" : ""} à examiner <span style={{ color: "var(--text3)" }}>· {reportCount} signalement{reportCount > 1 ? "s" : ""}</span>
        </span>
      </div>

      <div className="mod-grid">
        {groups.map(g => (
          <section key={g.pubId} className="dash-surface" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="mod-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</h3>
                <div style={{ fontSize: 12.5, color: "var(--text3)", marginTop: 3 }}>{g.items.length} signalement{g.items.length > 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => navigate(`${DISCOVER_PREFIX}${encodeURIComponent(g.pubId)}`)} className="pressable hover-neutral"
                style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 999, border: "none", fontSize: 13, fontWeight: 600, background: "var(--surface2)", color: "var(--text)", cursor: "pointer" }}>
                Voir la recette <Icon name="forward" size={13} color="currentColor" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.items.map(r => (
                <ReportRow key={r.id} report={r} busy={busy === r.id} onDismiss={() => dismissReport(r.id)} />
              ))}
            </div>

            {/* Action destructive : pastille rouge teintée, alignée à droite, sous les signalements. */}
            <button onClick={() => setConfirm({ pubId: g.pubId, name: g.name })} disabled={busy === g.pubId} className="pressable hover-danger mod-remove"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, height: 38, padding: "0 16px", borderRadius: 999, border: "none", fontSize: 13, fontWeight: 600, background: "rgba(var(--red-rgb),0.12)", color: "var(--red)", cursor: "pointer", opacity: busy === g.pubId ? 0.6 : 1 }}>
              <Icon name="trash" size={14} color="currentColor" /> Retirer de la communauté
            </button>
          </section>
        ))}
      </div>

      {confirm && (
        <ConfirmDialog title="Supprimer cette recette de la communauté ?" busy={busy === confirm.pubId}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { deleteReportedRecipe(confirm.pubId).finally(() => setConfirm(null)); }}>
          <strong style={{ color: "var(--text)" }}>« {confirm.name} »</strong> sera retirée de la communauté et ses signalements résolus. L'auteur en garde sa copie privée. Cette action est irréversible.
        </ConfirmDialog>
      )}
    </div>
  );
}
