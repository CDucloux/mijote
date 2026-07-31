/**
 * Détection des durées dans le texte d'une étape de recette et formatage des
 * comptes à rebours pour les minuteurs du mode cuisine.
 *
 * @module stepTimers
 */

/** Une durée détectée dans une étape : sa valeur en minutes et son libellé affichable. */
export interface StepDuration {
  /** Durée en minutes (arrondie, bornée à 24 h). */
  minutes: number;
  /** Libellé lisible tel qu'on l'affiche sur le bouton, ex. `"6 min"` ou `"1 h 30"`. */
  label: string;
}

/**
 * Repère les mentions de temps (« 6 min », « 6 minutes », « 1 h 30 », « 2 heures »)
 * dans le texte d'une étape pour proposer des minuteurs en un clic.
 *
 * Les heures sont converties en minutes ; les valeurs sont dédupliquées (par
 * nombre de minutes) et triées par ordre croissant. Le bruit courant (« 180°C »,
 * « quelques minutes ») est ignoré.
 *
 * @param text - Texte brut de l'étape.
 * @returns Les durées détectées, triées et dédupliquées.
 *
 * @example
 * parseDurations("cuire 6 minutes puis reposer 1 h 30");
 * // → [{ minutes: 6, label: "6 min" }, { minutes: 90, label: "1 h 30" }]
 */
export function parseDurations(text: string | null | undefined): StepDuration[] {
  if (!text) return [];
  const seen = new Set<number>();
  const out: StepDuration[] = [];
  const push = (minutes: number, label: string): void => {
    const m = Math.round(minutes);
    if (m > 0 && m <= 24 * 60 && !seen.has(m)) { seen.add(m); out.push({ minutes: m, label }); }
  };

  // 1) Heures d'abord (« 1 h », « 1h30 », « 1 h 30 », « 2 heures », « 1 heure 30 »).
  //    On neutralise les portions consommées pour que le passage « minutes » ne
  //    reprenne pas les mêmes chiffres.
  const hourRe = /(\d+)\s*h(?:eures?)?(?:\s*(\d{1,2}))?/gi;
  const work = text.replace(hourRe, (full: string, h: string, mm?: string) => {
    const mins = mm ? Number(mm) : 0;
    push(Number(h) * 60 + mins, mins ? `${h} h ${String(mins).padStart(2, "0")}` : `${h} h`);
    return " ".repeat(full.length);
  });

  // 2) Minutes (« 6 min », « 6 minutes », « 6 mn »). Frontière de mot exigée.
  const minRe = /(\d+)\s*(?:min(?:ute)?s?|mn)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = minRe.exec(work)) !== null) push(Number(m[1]), `${m[1]} min`);

  return out.sort((a, b) => a.minutes - b.minutes);
}

/**
 * Formate une durée en secondes vers un compte à rebours `m:ss`.
 *
 * @param totalSec - Nombre de secondes restantes (négatif traité comme 0).
 * @returns Une chaîne `m:ss`, ex. `fmtCountdown(90) === "1:30"`.
 */
export function fmtCountdown(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
