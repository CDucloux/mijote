// ─── DÉTECTION DES DURÉES DANS UNE ÉTAPE ──────────────────────────────────────
// Repère les mentions de temps (« 6 min », « 6 minutes », « 1 h 30 », « 2 heures »)
// dans le texte d'une étape pour proposer des minuteurs en un clic. Renvoie une
// liste dédupliquée et triée : [{ minutes, label }].
export function parseDurations(text) {
  if (!text) return [];
  const seen = new Set();
  const out = [];
  const push = (minutes, label) => {
    const m = Math.round(minutes);
    if (m > 0 && m <= 24 * 60 && !seen.has(m)) { seen.add(m); out.push({ minutes: m, label }); }
  };

  // 1) Heures d'abord (« 1 h », « 1h30 », « 1 h 30 », « 2 heures », « 1 heure 30 »).
  //    On neutralise les portions consommées pour que le passage « minutes » ne
  //    reprenne pas les mêmes chiffres.
  const hourRe = /(\d+)\s*h(?:eures?)?(?:\s*(\d{1,2}))?/gi;
  const work = text.replace(hourRe, (full, h, mm) => {
    const mins = mm ? Number(mm) : 0;
    push(Number(h) * 60 + mins, mins ? `${h} h ${String(mins).padStart(2, "0")}` : `${h} h`);
    return " ".repeat(full.length);
  });

  // 2) Minutes (« 6 min », « 6 minutes », « 6 mn »). Frontière de mot exigée.
  const minRe = /(\d+)\s*(?:min(?:ute)?s?|mn)\b/gi;
  let m;
  while ((m = minRe.exec(work)) !== null) push(Number(m[1]), `${m[1]} min`);

  return out.sort((a, b) => a.minutes - b.minutes);
}

// mm:ss pour l'affichage d'un compte à rebours.
export function fmtCountdown(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
