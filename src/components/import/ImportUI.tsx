import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../ui/Icon.jsx";
import { LogoPod } from "../ui/LogoPod.jsx";
import { IMPORT_STEPS, importProgress, importStepIndex } from "@/lib/recipes/importProgress.js";

// ─── OVERLAY D'ATTENTE DE L'IMPORT INTELLIGENT ───────────────────────────────
// L'import intelligent consomme un crédit : l'écran d'attente est VOLONTAIREMENT
// non-annulable (pas de fermeture, pas de swipe, pas de bouton) pour éviter
// qu'un crédit parte dans le vide.

/**
 * Overlay plein écran non-annulable pendant l'extraction IA : les phases de
 * l'extraction se cochent une à une, sous une barre de progression calée sur la
 * durée estimée (cf. `importProgress`). Le composant est démonté quand la promesse
 * se résout, sa disparition fait office de « terminé ».
 *
 * @param estimateMs - Durée estimée de l'extraction en ms (défaut 24000).
 */
export function LoadingOverlay({ estimateMs = 24000 }: { estimateMs?: number }) {
  // La requête d'extraction attend le réseau (thread libre), le timer tourne donc
  // sans à-coups ; une transition CSS lisse les paliers de la barre.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setProgress(importProgress(performance.now() - start, estimateMs)), 200);
    return () => clearInterval(id);
  }, [estimateMs]);

  const current = importStepIndex(progress);
  const pct = Math.round(progress * 100);

  return createPortal(
    <div className="import-wait-backdrop">
      <div className="import-wait" role="status" aria-label={`${IMPORT_STEPS[current]}, ${pct} %`}>
        <div className="import-wait__head">
          <LogoPod size={40} className="loading-mark import-wait__pod" />
          <h3 className="import-wait__title">Ta recette prend forme</h3>
        </div>
        <ol className="import-wait__steps" aria-hidden="true">
          {IMPORT_STEPS.map((step, i) => (
            <li key={step} className={i < current ? "done" : i === current ? "current" : undefined}>
              <span className="import-wait__dot"><Icon name="check" size={12} color="#fff" /></span>
              {step}
            </li>
          ))}
        </ol>
        <div className="import-wait__bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        <div className="import-wait__foot" aria-hidden="true">
          <span>Extraction en cours</span>
          <span className="import-wait__pct">{pct} %</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
