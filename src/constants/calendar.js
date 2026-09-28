// Libellés de calendrier partagés (planning, feuilles de replanification/duplication).
// Source unique pour éviter de dupliquer ces tableaux d'un composant à l'autre.
export const DAYS_SHORT_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/** Index 0 = lundi … 6 = dimanche, pour indexer DAYS_SHORT_FR depuis un Date. */
export const mondayFirstIndex = (jsDay) => (jsDay === 0 ? 6 : jsDay - 1);
