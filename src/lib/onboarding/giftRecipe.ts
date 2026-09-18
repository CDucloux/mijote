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
 * Recette choisie pour Cardamome : chaleureuse, gourmande, universelle, et assez
 * complète (découpes, photos d'étapes, réglages de four) pour montrer toute la
 * richesse de la mise en forme. Ne dépend d'aucune I/O : les `dbId`, le Nutri-Score
 * et le rapprochement des ustensiles sont (re)résolus à l'import comme pour n'importe
 * quelle recette.
 */
export const GIFT_RECIPE: Recipe = {
  name: "Tarte fine à la courgette",
  category: "tarte",
  cuisine: "Française",
  source: "https://www.cestmafournee.com/2019/07/tarte-fine-la-courgette.html",
  image: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgAdYGGLoZABMIit-fg9O4L2KLNFF-lQeElA0UC2zxpDIc6v412SY4dfZ5y7PDljKQUiGvhN9XNVEbK01Ra3jDoxe5ce61KECdtkgimAXsSWcdOBnY8FLhDzK4wMXb0E5JKjPK9LXJrY16O/w1200-h630-p-k-no-nu/TARTE+FINE+A%25CC%2580+LA+COURGETTEb611.jpg",
  servings: 2,
  prepTime: 20,
  cookTime: 35,
  ingredients: [
    { id: "i0", dbId: "", name: "pâte feuilletée pur beurre", amount: 1, unit: "" },
    { id: "i1", dbId: "db_i1781044668591", name: "courgette", amount: 2, unit: "", cut: { forme: "lamelle", calibre: "fin" } },
    { id: "i2", dbId: "", name: "Boursin Cuisine", amount: 125, unit: "g" },
    { id: "i3", dbId: "db_i1781253156039", name: "menthe fraîche", amount: 1, unit: "poignée", cut: { forme: "cisele" } },
    { id: "i4", dbId: "db_i1781128389827", name: "huile d'olive", amount: 1, unit: "cuillère à soupe" },
    { id: "i5", dbId: "db_i1781281460801", name: "pignons de pin", amount: 30, unit: "g" },
    { id: "i6", dbId: "db_i1786526155585", name: "fleur de sel", amount: 2, unit: "g" },
    { id: "i7", dbId: "db_i1781255089151", name: "poivre", amount: 1, unit: "g" },
  ],
  utensils: [
    { id: "u0", dbId: "db_u_mandoline", name: "Mandoline" },
    { id: "u1", dbId: "db_u1787040053960", name: "Four" },
    { id: "u2", dbId: "db_u1781433337569", name: "Plaque de cuisson perforée" },
    { id: "u3", dbId: "db_u1781260839626", name: "Fourchette" },
    { id: "u4", dbId: "db_u1782070723844", name: "Pinceau de cuisine" },
    { id: "u5", dbId: "db_u1782070205135", name: "Papier cuisson" },
  ],
  steps: [
    {
      id: "s0",
      text: "Émincer les courgettes à la mandoline réglée sur 1,5 mm de finesse, ou utiliser un robot pour obtenir des tranches très fines et régulières.",
      ingredients: ["i1"],
      utensils: ["u0"],
      tip: "Si vous n'avez pas de mandoline, un robot convient aussi ; à défaut, utiliser un couteau reste possible mais moins régulier.",
    },
    {
      id: "s1",
      text: "Préchauffer le four à 180°C en mode chaleur tournante avec sole (résistances du haut et du bas), ou en chaleur traditionnelle si ce mode n'existe pas. Placer une grille au milieu du four.",
      ingredients: [],
      utensils: ["u1"],
      tip: "La chaleur tournante et sole permettent de bien cuire la pâte en dessous et de griller les courgettes sans trop cuire l'ensemble.",
      utensilParams: { u1: { prechauffage: true, temperature: 180, mode: "tournante" } },
    },
    {
      id: "s2",
      text: "Déposer le disque de pâte feuilletée sur la plaque de cuisson perforée (en laissant le papier sulfurisé), puis piquer généreusement la pâte avec une fourchette.",
      ingredients: ["i0"],
      utensils: ["u2", "u3"],
      image: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjqwDQ7cZ_wNxtJwVFDy6V_UpZNztfu_8grTSUy9uIkN_5hPgx5pnN3AhXHpnd-8eC_DRq73Hw6qsQesdKMNzWm0o95EHRVm0xbL0B9oPlsqDrnUJ8ZUZV3CczQhioB0eZ4kFlwtkv6nfZF/s400/1OT%2525oB1dSSiR73mP1KRNrA_thumb_b53b.jpg",
    },
    {
      id: "s3",
      text: "Étaler le Boursin Cuisine sur toute la surface de la pâte, ajouter la menthe ciselée un peu partout, puis poivrer généreusement.",
      ingredients: ["i2", "i3", "i7"],
      utensils: [],
      image: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjHnM46p5QWRr1jsnBj5IPRyHNsvHvYkj-cxt2gGbawzmN1_RN3fK6rufP_Zsl_ReGDsCdbomsH7UHimHgqT5j9XMP-GnnQ-vcTp5Xbv8FJm1EWcFPC7LlgiS35kPtE4xEu5boNUG9SCKnH/s400/NAeGHXqyTC%252BHQovxBfpqkg_thumb_b539.jpg",
    },
    {
      id: "s4",
      text: "Disposer les tranches de courgette de manière relativement serrée sur la préparation.",
      ingredients: ["i1"],
      utensils: [],
      image: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjng2haUF7UVv2iEtEt7PBELHMKgA-5_WnPKYNXLc1yJIvW0mMzztgMPsFLcN9vZMkUkQcXnVVvPtuLMBA2dB5FwfyAzXIhPx_8aJ7xP2wQ17oPAAqsyccxzNst940HV_Lg2tPIKPBK_suv/s400/w61ktndzRwSAjMU9ohIJ2A_thumb_b554.jpg",
    },
    {
      id: "s5",
      text: "Badigeonner les courgettes avec l'huile d'olive à l'aide d'un pinceau, parsemer quelques pignons un peu partout, puis enfourner pour environ 35 minutes.",
      ingredients: ["i4", "i5"],
      utensils: ["u1", "u4"],
      tip: "Surveiller la cuisson : la pâte doit être bien cuite en dessous sans être brûlée sur les côtés, et les courgettes doivent être légèrement grillées. Le temps de cuisson peut varier selon les fours.",
      utensilParams: { u1: { temperature: 180, duree: 35, mode: "tournante" } },
    },
    {
      id: "s6",
      text: "Retirer la tarte du four. Si elle ne semble pas assez salée, ajouter très légèrement un peu de fleur de sel pendant qu'elle est encore chaude. Décorer avec quelques feuilles de menthe fraîche.",
      ingredients: ["i3", "i6"],
      utensils: ["u1"],
      tip: "Aller prudemment sur le sel car les courgettes sont très fines et l'assaisonnement peut vite être excessif.",
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
  title: "Tarte fine à la courgette",
  /** Accroche courte, pour situer le cadeau sans survendre. */
  teaser: "Fine, fondante et estivale, prête à relire en un clic.",
} as const;
