/**
 * Titre de l'onglet navigateur, dérivé de l'écran affiché.
 *
 * @module ui/pageTitle
 */

const TAB_TITLES: Record<string, string> = { home: "Accueil", recipes: "Recettes", "meal-plan": "Planning", shopping: "Courses", stock: "Mon Stock", admin: "Console admin", profile: "Profil", legal: "Informations légales", guide: "Guide" };

/** Ce que l'écran courant expose pour nommer l'onglet. */
export interface PageTitleInput {
  /** Onglet courant (repli). */
  tab: string;
  /** Recette en cours d'édition (`""`/absent = nouvelle recette), ou null hors éditeur. */
  editedName?: string | null;
  /** Vrai si l'éditeur est ouvert. */
  editing: boolean;
  /** Nom de la recette consultée (publique ou privée). */
  viewedName?: string | null;
  /** Nom de l'ingrédient de la fiche ouverte. */
  ingredientName?: string | null;
  /** Écran hors onglets ouvert (ex. abonnement). */
  routeName?: string | null;
}

/**
 * Nomme l'onglet : recette (éditée puis consultée), puis fiche ingrédient, puis écran
 * hors onglets, puis l'onglet courant, avec « Accueil » en dernier recours.
 *
 * @param input - Signaux de l'écran courant.
 * @returns Le titre complet, préfixé « Cardamome | ».
 */
export function pageTitle({ tab, editedName, editing, viewedName, ingredientName, routeName }: PageTitleInput): string {
  const recipeName = editing ? (editedName?.trim() || "Nouvelle recette") : viewedName;
  return `Cardamome | ${recipeName || ingredientName || routeName || TAB_TITLES[tab] || "Accueil"}`;
}
