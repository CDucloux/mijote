/**
 * Activité cuisine (heatmap façon GitHub, logique pure). Dérive un calendrier
 * d'activité du planning : chaque jour porte le nombre de repas planifiés (proxy
 * de « ce que tu as cuisiné »). Alimente la heatmap du profil. Aucune I/O.
 *
 * @module cookingActivity
 */

/** Planning : clé jour `YYYY-MM-DD` → items de repas. */
export type MealPlan = Record<string, unknown[]>;

/** Une case de la heatmap. */
export interface HeatmapCell {
  key: string;
  date: Date;
  count: number;
  future: boolean;
  /** Niveau 0–4 pour la couleur ; `-1` pour une case future (non peinte). */
  level: number;
}

/** Statistiques agrégées de la heatmap. */
export interface Heatmap {
  cols: HeatmapCell[][];
  total: number;
  activeDays: number;
  thisWeek: number;
  streak: number;
  max: number;
}

/** Clé jour → nombre d'items de repas (compatible avec les clés `YYYY-MM-DD`). */
export function activityCounts(mealPlan: MealPlan = {}): Map<string, number> {
  const m = new Map<string, number>();
  for (const [date, items] of Object.entries(mealPlan)) {
    if (Array.isArray(items) && items.length) m.set(date, items.length);
  }
  return m;
}

/** Niveau d'intensité 0..4 pour la couleur d'une case. */
export function activityLevel(count: number): number {
  if (!count) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

const keyOf = (d: Date): string => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/**
 * Construit la grille de la heatmap : colonnes = semaines (lundi→dimanche), se
 * terminant à `end` (défaut : aujourd'hui).
 */
export function buildHeatmap(mealPlan: MealPlan = {}, { weeks = 26, end }: { weeks?: number; end?: Date | string } = {}): Heatmap {
  const counts = activityCounts(mealPlan);
  const last = end ? new Date(end) : new Date();
  last.setHours(12, 0, 0, 0); // midi : évite les bascules de date via toISOString

  // Début = lundi, `weeks` colonnes jusqu'à `last`.
  let start = addDays(last, -(weeks * 7 - 1));
  const dow = (start.getDay() + 6) % 7; // 0 = lundi
  start = addDays(start, -dow);

  const cols: HeatmapCell[][] = [];
  let cur = new Date(start);
  let total = 0, activeDays = 0, max = 0;
  while (cur <= last) {
    const col: HeatmapCell[] = [];
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
