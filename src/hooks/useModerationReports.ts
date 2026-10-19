import { useEffect, useState } from "react";
import { loadReports, resolveReport, resolveReportsForRecipe, deletePublicRecipe } from "@/lib/firebase/community.js";
import type { StoredReport } from "@/lib/firebase/community.js";

/**
 * Signalements de recettes publiques pour la modération admin : chargement, rejet
 * d'un signalement, suppression d'une recette de la communauté (ses signalements
 * sont alors résolus). `busy` porte l'id (rejet) ou le pubId (suppression) en cours.
 *
 * @param isAdmin - Seul l'admin lit les signalements.
 */
export function useModerationReports(isAdmin: boolean) {
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    loadReports().then(r => { if (alive) setReports(r); }).catch(() => { });
    return () => { alive = false; };
  }, [isAdmin]);

  const dismissReport = async (id: string) => {
    setBusy(id);
    try { await resolveReport(id); setReports(rs => rs.filter(r => r.id !== id)); } finally { setBusy(null); }
  };

  const deleteReportedRecipe = async (pubId: string) => {
    setBusy(pubId);
    try {
      await deletePublicRecipe(pubId);
      await resolveReportsForRecipe(pubId);
      setReports(rs => rs.filter(r => r.pubId !== pubId));
    } finally { setBusy(null); }
  };

  return { reports, busy, dismissReport, deleteReportedRecipe };
}
