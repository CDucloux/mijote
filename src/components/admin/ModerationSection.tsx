import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../ui/Icon.jsx";
import { ConfirmDialog } from "../ui/ConfirmDialog.jsx";
import { groupReportsByRecipe } from "@/lib/household/masterDrafts.js";
import { DISCOVER_PREFIX } from "../../hooks/usePublicRecipeView.js";
import type { StoredReport } from "@/lib/firebase/community.js";
import type { useModerationReports } from "../../hooks/useModerationReports.js";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

function ModerationEmpty() {
  return (
    <div className="slide-up" style={{ minHeight: "46vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "var(--text3)", gap: 12 }}>
      <span style={{ width: 60, height: 60, borderRadius: 20, background: "rgba(var(--ok-rgb),0.12)", display: "grid", placeItems: "center" }}>
        <Icon name="check" size={26} color="var(--ok)" />
      </span>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>Aucun signalement</div>
      <div style={{ fontSize: 12.5, maxWidth: 260, lineHeight: 1.5 }}>Rien à modérer pour l'instant. Les recettes signalées par la communauté apparaîtront ici.</div>
    </div>
  );
}

function ReportRow({ report, first, busy, onDismiss }: { report: StoredReport; first: boolean; busy: boolean; onDismiss: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 15px", borderTop: first ? "none" : "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: report.note ? 5 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--red)", background: "rgba(224,82,82,0.1)", border: "1px solid rgba(224,82,82,0.28)", borderRadius: 7, padding: "2px 8px" }}>{report.reason}</span>
          {report.createdAtMs != null && <span style={{ fontSize: 11, color: "var(--text3)" }}>{fmtDate(report.createdAtMs)}</span>}
        </div>
        {report.note && <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, margin: "0 0 4px", wordBreak: "break-word" }}>« {report.note} »</p>}
        {report.reporterEmail && <div style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Signalé par {report.reporterEmail}</div>}
      </div>
      <button onClick={onDismiss} disabled={busy} title="Rejeter ce signalement" className="pressable"
        style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)", cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
        <Icon name="close" size={12} color="var(--text3)" /> Rejeter
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
  return (
    <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groups.map(g => (
        <div key={g.pubId} style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
          {/* En-tête recette */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 15px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(224,82,82,0.12)", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Icon name="warning" size={15} color="var(--red)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 1 }}>{g.items.length} signalement{g.items.length > 1 ? "s" : ""}</div>
            </div>
            <button onClick={() => navigate(`${DISCOVER_PREFIX}${encodeURIComponent(g.pubId)}`)} className="pressable"
              style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, height: 32, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "var(--surface2)", color: "var(--text2)", border: "1px solid var(--border)", cursor: "pointer" }}>
              <Icon name="forward" size={13} color="var(--text2)" /> Ouvrir
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {g.items.map((r, i) => (
              <ReportRow key={r.id} report={r} first={i === 0} busy={busy === r.id} onDismiss={() => dismissReport(r.id)} />
            ))}
          </div>

          {/* Action destructive */}
          <div style={{ padding: "12px 15px", borderTop: "1px solid var(--border)", background: "rgba(224,82,82,0.03)" }}>
            <button onClick={() => setConfirm({ pubId: g.pubId, name: g.name })} disabled={busy === g.pubId} className="pressable"
              style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 14px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, background: "rgba(224,82,82,0.12)", color: "var(--red)", border: "1px solid rgba(224,82,82,0.4)", cursor: "pointer", opacity: busy === g.pubId ? 0.6 : 1 }}>
              <Icon name="trash" size={14} color="var(--red)" /> Supprimer la recette de la communauté
            </button>
          </div>
        </div>
      ))}

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
