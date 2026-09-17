import type { Recipe } from "@/lib/types.js";

/**
 * Recette découverte OFFERTE aux non-abonnés à leur première tentative d'import.
 *
 * Le montage produit est assumé : au lieu d'appeler le LLM (coûteux) pour un
 * non-abonné, on lui sert cette recette pré-écrite via le pipeline d'import
 * habituel ({@link useRecipeImport}). Il vit l'effet « import magique » (overlay
 * de chargement puis brouillon complet dans l'éditeur) pour 0 crédit et 0 appel
 * serveur. La recette est présentée comme un cadeau (« recette découverte »),
 * jamais comme le résultat de sa propre saisie : l'honnêteté fait l'effet wahou,
 * pas la tromperie.
 *
 * Recette choisie pour Cardamome : chaleureuse, gourmande, universelle, avec
 * assez de matière (sections, ustensiles, étapes) pour montrer la mise en forme.
 * Ne dépend d'aucune I/O : les `dbId`, le Nutri-Score et le rapprochement des
 * ustensiles sont résolus à l'import comme pour n'importe quelle recette.
 */
export const GIFT_RECIPE: Recipe = {
  name: "Tarte au citron meringuée",
  category: "Dessert",
  cuisine: "Française",
  source: "Cardamome",
  servings: 8,
  prepTime: 40,
  cookTime: 35,
  difficulty: 3,
  ingredients: [
    { name: "Farine", amount: 250, unit: "g", group: "Pour la pâte sablée" },
    { name: "Beurre", amount: 125, unit: "g", group: "Pour la pâte sablée" },
    { name: "Sucre glace", amount: 90, unit: "g", group: "Pour la pâte sablée" },
    { name: "Œuf", amount: 1, unit: "", group: "Pour la pâte sablée" },
    { name: "Sel", amount: 1, unit: "pincée", group: "Pour la pâte sablée" },
    { name: "Citron", amount: 3, unit: "", group: "Pour la crème au citron" },
    { name: "Sucre", amount: 150, unit: "g", group: "Pour la crème au citron" },
    { name: "Œuf", amount: 3, unit: "", group: "Pour la crème au citron" },
    { name: "Beurre", amount: 75, unit: "g", group: "Pour la crème au citron" },
    { name: "Maïzena", amount: 30, unit: "g", group: "Pour la crème au citron" },
    { name: "Blanc d'œuf", amount: 3, unit: "", group: "Pour la meringue" },
    { name: "Sucre", amount: 150, unit: "g", group: "Pour la meringue" },
  ],
  utensils: [
    { name: "Moule à tarte" },
    { name: "Casserole" },
    { name: "Fouet" },
    { name: "Batteur électrique" },
    { name: "Four" },
  ],
  steps: [
    {
      text: "Sable la farine avec le beurre froid coupé en dés, le sucre glace et le sel du bout des doigts. Ajoute l'œuf, rassemble en boule sans trop travailler, filme et laisse reposer 30 min au frais.",
      group: "Pour la pâte sablée",
    },
    {
      text: "Étale la pâte, fonce le moule à tarte, pique le fond à la fourchette et enfourne à blanc 20 min à 180°C, jusqu'à une belle couleur dorée. Laisse tiédir.",
      group: "Pour la pâte sablée",
    },
    {
      text: "Prélève le zeste puis le jus des citrons. Fouette les œufs avec le sucre et la maïzena, ajoute le jus et le zeste, puis fais épaissir à feu doux dans la casserole sans cesser de remuer.",
      group: "Pour la crème au citron",
    },
    {
      text: "Hors du feu, incorpore le beurre en morceaux jusqu'à une crème lisse et brillante. Verse sur le fond de tarte et lisse à la spatule.",
      group: "Pour la crème au citron",
    },
    {
      text: "Monte les blancs en neige au batteur, serre-les en versant le sucre en trois fois jusqu'à obtenir une meringue ferme et brillante.",
      group: "Pour la meringue",
    },
    {
      text: "Dresse la meringue sur la crème au citron, forme des pics à la spatule et colore 8 à 10 min à 180°C (ou au chalumeau). Sers bien frais.",
      tip: "Pour une meringue qui ne retombe pas, ajoute le sucre dès que les blancs commencent à mousser.",
      group: "Pour la meringue",
    },
  ],
};

/**
 * Descripteur d'affichage de l'offre cadeau (feuille présentée avant l'import).
 * Séparé de {@link GIFT_RECIPE} pour que l'UI n'ait pas à connaître la forme
 * complète d'une recette.
 */
export const GIFT_OFFER = {
  /** Titre de la recette offerte, montré dans la feuille d'offre. */
  title: "Tarte au citron meringuée",
  /** Accroche courte, pour situer le cadeau sans survendre. */
  teaser: "Un classique acidulé et gourmand, prêt à relire en un clic.",
} as const;
