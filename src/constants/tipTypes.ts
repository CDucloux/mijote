// Types de conseils d'un ingrédient (source unique : affichage + éditeur + markdown).
// L'ordre des clés sert d'ordre d'affichage par défaut dans la fiche.
/** Présentation d'un type de conseil. */
export interface TipType {
  label: string;
  icon: string;
  color: string;
}

export const TIP_TYPES: Record<string, TipType> = {
  prep: { label: "Préparation", icon: "🔪", color: "#e8703a" },
  conservation: { label: "Choix & conservation", icon: "🛒", color: "#f0b429" },
  usage: { label: "Utilisation", icon: "🍳", color: "#ef8b4a" },
  freezing: { label: "Congélation", icon: "❄️", color: "#4a90d9" },
  antigaspi: { label: "Astuce anti-gaspi", icon: "💡", color: "#9b87f5" },
  // Conservé pour compatibilité avec les anciennes fiches.
  benefit: { label: "Bienfaits", icon: "🌿", color: "#4caf7d" },
};

// Ordre d'affichage des tips dans la fiche ingrédient.
export const TIP_ORDER: string[] = Object.keys(TIP_TYPES);
