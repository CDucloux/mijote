/** Couleur d'un niveau de difficulté de geste : vert, puis ambre, puis rouge. */
export const difficultyColor = (level: number): string => level <= 2 ? "var(--ok)" : level === 3 ? "#e8920a" : "var(--red)";

/** Libellé d'un niveau de difficulté (1 à 5). */
export const DIFFICULTY_LABEL: Record<number, string> = { 1: "Très facile", 2: "Facile", 3: "Intermédiaire", 4: "Difficile", 5: "Expert" };
