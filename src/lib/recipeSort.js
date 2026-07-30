import { computeDifficulty } from "./difficulty.js";

// ─── TRI DES RECETTES ─────────────────────────────────────────────────────────
// Chaque option de tri porte ses deux sens de lecture (avec des libellés parlants
// plutôt que « croissant / décroissant »). `dirs[0]` est le sens par défaut quand
// on sélectionne le critère.
export const SORT_OPTIONS = [
  { key: "date", label: "Récent", icon: "history", dirs: [
    { dir: "desc", label: "Plus récent" }, { dir: "asc", label: "Plus ancien" },
  ] },
  { key: "name", label: "A → Z", icon: "az", dirs: [
    { dir: "asc", label: "A → Z" }, { dir: "desc", label: "Z → A" },
  ] },
  { key: "health", label: "Nutri-Score", icon: "heart", dirs: [
    { dir: "desc", label: "Meilleur d'abord" }, { dir: "asc", label: "Moins bon d'abord" },
  ] },
  { key: "time", label: "Temps", icon: "clock", dirs: [
    { dir: "asc", label: "Plus rapide" }, { dir: "desc", label: "Plus long" },
  ] },
  { key: "difficulty", label: "Difficulté", icon: "fire", dirs: [
    { dir: "asc", label: "Plus facile" }, { dir: "desc", label: "Plus difficile" },
  ] },
];

export const DEFAULT_SORT_KEY = "date";
export const sortOption = (key) => SORT_OPTIONS.find(o => o.key === key) || SORT_OPTIONS[0];
export const defaultDirFor = (key) => sortOption(key).dirs[0].dir;
export const dirLabel = (key, dir) => (sortOption(key).dirs.find(d => d.dir === dir) || sortOption(key).dirs[0]).label;

// Horodatage ms encodé dans l'id ("r"+Date.now()…) → départage les recettes créées
// le même jour (createdAt est au jour près, et parfois absent). 0 si non horodaté.
const idTimestamp = (id) => { const m = /^r(\d{10,})/.exec(id || ""); return m ? Number(m[1]) : 0; };
// Récence DÉCROISSANTE (plus récent d'abord) : createdAt (jour) puis id.
export const byRecent = (a, b) => {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  const da = Number.isNaN(ta) ? 0 : ta, db = Number.isNaN(tb) ? 0 : tb;
  return db !== da ? db - da : idTimestamp(b.id) - idTimestamp(a.id);
};

const timeOf = (r) => { const t = (r.prepTime || 0) + (r.cookTime || 0); return t > 0 ? t : null; };

// Construit le comparateur pour la clé + le sens demandés. `byRecent` sert de
// départage stable, et les recettes sans valeur (temps/nutri/difficulté inconnus)
// sont toujours reléguées en fin de liste, quel que soit le sens.
export function makeComparator({ sortBy, sortDir, techniques, techIndex, recipes }) {
  if (sortBy === "name") {
    return (a, b) => (sortDir === "asc" ? 1 : -1) * a.name.localeCompare(b.name, "fr");
  }
  if (sortBy === "date") {
    return (a, b) => (sortDir === "desc" ? 1 : -1) * byRecent(a, b);
  }
  const diffCache = new Map();
  const valueOf = (r) => {
    if (sortBy === "health") return typeof r.healthScore === "number" ? r.healthScore : null;
    if (sortBy === "time") return timeOf(r);
    if (sortBy === "difficulty") {
      if (!diffCache.has(r.id)) diffCache.set(r.id, computeDifficulty(r, techniques, { index: techIndex, recipes }).score);
      return diffCache.get(r.id);
    }
    return null;
  };
  return (a, b) => {
    const va = valueOf(a), vb = valueOf(b);
    const na = va == null || Number.isNaN(va), nb = vb == null || Number.isNaN(vb);
    if (na && nb) return byRecent(a, b);
    if (na) return 1;
    if (nb) return -1;
    if (va === vb) return byRecent(a, b);
    return (sortDir === "asc" ? 1 : -1) * (va - vb);
  };
}
