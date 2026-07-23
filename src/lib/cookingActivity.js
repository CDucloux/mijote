// ─── ACTIVITÉ CUISINE (heatmap façon GitHub, logique pure) ───────────────────
// Dérive un calendrier d'activité du planning : chaque jour porte le nombre de
// repas planifiés (proxy de « ce que tu as cuisiné »). Sert à alimenter la
// heatmap du profil. Pur et testable ; aucune I/O.

// Clé jour → nombre d'items de repas (compatible avec les clés YYYY-MM-DD du mealPlan).
export function activityCounts(mealPlan = {}) {
  const m = new Map();
  for (const [date, items] of Object.entries(mealPlan)) {
    if (Array.isArray(items) && items.length) m.set(date, items.length);
  }
  return m;
}

// Niveau d'intensité 0..4 pour la couleur d'une case.
export function activityLevel(count) {
  if (!count) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

const keyOf = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Construit la grille de la heatmap : colonnes = semaines (lundi→dimanche), se
// terminant à `end`. Renvoie { cols, total, activeDays, thisWeek, streak, max }.
export function buildHeatmap(mealPlan = {}, { weeks = 26, end } = {}) {
  const counts = activityCounts(mealPlan);
  const last = end ? new Date(end) : new Date();
  last.setHours(12, 0, 0, 0); // midi : évite les bascules de date via toISOString

  // Début = lundi, `weeks` colonnes jusqu'à `last`.
  let start = addDays(last, -(weeks * 7 - 1));
  const dow = (start.getDay() + 6) % 7; // 0 = lundi
  start = addDays(start, -dow);

  const cols = [];
  let cur = new Date(start);
  let total = 0, activeDays = 0, max = 0;
  while (cur <= last) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const future = cur > last;
      const key = keyOf(cur);
      const count = future ? 0 : (counts.get(key) || 0);
      if (!future && count > 0) { total += count; activeDays++; if (count > max) max = count; }
      col.push({ key, date: new Date(cur), count, future, level: future ? -1 : activityLevel(count) });
      cur = addDays(cur, 1);
    }
    cols.push(col);
  }

  // 7 derniers jours (repas), et série courante de jours actifs consécutifs jusqu'à `last`.
  let thisWeek = 0;
  for (let i = 0; i < 7; i++) thisWeek += counts.get(keyOf(addDays(last, -i))) || 0;
  let streak = 0;
  for (let i = 0; ; i++) { const c = counts.get(keyOf(addDays(last, -i))) || 0; if (c > 0) streak++; else break; }

  return { cols, total, activeDays, thisWeek, streak, max };
}
