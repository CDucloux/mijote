/**
 * Calendrier de la semaine du planning (lundi → dimanche). Logique pure.
 *
 * @module planning/weekDays
 */

/**
 * Les 7 jours (`YYYY-MM-DD`) de la semaine contenant `ref`, du lundi au dimanche.
 * Le planning raisonne en semaines « à la française » : un dimanche appartient à
 * la semaine qui a commencé le lundi précédent.
 *
 * @param ref - Un instant quelconque de la semaine voulue.
 * @returns Les dates ISO du lundi au dimanche.
 */
export function mondayWeekDays(ref: Date): string[] {
  const monday = new Date(ref);
  const day = monday.getDay();
  monday.setDate(monday.getDate() + (day === 0 ? -6 : 1 - day));
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date.toISOString().slice(0, 10);
  });
}

/**
 * Décale une date d'un nombre entier de semaines (navigation semaine précédente /
 * suivante), sans muter l'original.
 *
 * @param date - Date de départ.
 * @param weeks - Nombre de semaines (négatif = vers le passé).
 * @returns Une nouvelle date décalée de `weeks × 7` jours.
 */
export function shiftWeeks(date: Date, weeks: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + weeks * 7);
  return next;
}
