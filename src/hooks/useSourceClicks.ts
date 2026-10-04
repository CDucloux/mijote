import { useEffect, useState } from "react";
import { fetchSourceClicks, type SourceClickCount } from "@/lib/firebase/sourceClicks.js";
import { clickMonth } from "@/lib/sources/outboundLink.js";

/**
 * Compteurs de clics sortants du mois en cours (admin uniquement : les règles
 * refusent la lecture aux autres). Vide hors admin ou en cas d'échec de lecture.
 *
 * @param isAdmin - Lecture autorisée.
 * @returns Les compteurs du mois.
 */
export function useSourceClicks(isAdmin: boolean): SourceClickCount[] {
  const [counts, setCounts] = useState<SourceClickCount[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    fetchSourceClicks(clickMonth(new Date()))
      .then(next => { if (alive) setCounts(next); })
      .catch(() => {});
    return () => { alive = false; };
  }, [isAdmin]);
  return counts;
}
