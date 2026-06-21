// ─── CHANGELOG ────────────────────────────────────────────────────────────────
export const CHANGELOG = [
  {
    version: "1.0.6", label: "en cours", accent: true,
    // 1 à 2 nouveautés phares mises en avant dans le bandeau d'annonce.
    highlights: [
      "Vos images sont désormais disponibles hors-ligne ⚡",
      "Nouvelle vue Étagères dans le Frigo 🗄️",
    ],
    items: [
      "Routage URL complet : chaque recette a son propre lien /recipes/:id",
      "Écran de chargement animé avec spinner après connexion Google",
      "En-tête fixe dans le détail d'une recette lors du scroll",
      "Suppression du mode \"Mois\" dans le planning",
      "Animations d'entrée sur toutes les pages",
      "Sélecteur d'ustensiles moderne avec images et recherche",
      "Bandeau \"Mode Lecture\" dans la configuration",
      "Notifications toast avec icône et animation corrigée",
    ],
  },
  {
    version: "1.0.5", label: "Simplification & Partage",
    items: [
      "Courses : tri par catégorie + alphabétique, suppression des filtres manuels",
      "Catégorie \"Pris\" → \"Acheté\" déplacée en bas",
      "Badge Hors ligne orange / vert selon synchronisation Firebase",
      "Config ustensiles : 3–4 cards par ligne sur desktop, tri alphabétique",
      "Partage de liste de courses (version alpha)",
    ],
  },
  {
    version: "1.0.4", label: "Mode Courses & Frigo",
    items: [
      "Courses : coller une liste séparée par des sauts de ligne",
      "Passage dans \"Acheté\" fluide (animation)",
      "Modification et suppression individuelles d'articles",
      "Recherche Frigo identique aux autres pages",
      "Mode pas à pas : correction mobile + ustensiles intégrés",
    ],
  },
  {
    version: "1.0.3", label: "PDF & Qualité",
    items: [
      "Parsing des pluriels amélioré",
      "Nombre d'ingrédients sur chaque carte de recette",
      "PDF : marges réduites, image principale, sauts de page gérés",
      "Limite maximale de 24 portions",
    ],
  },
  {
    version: "1.0.2", label: "UX & Animations",
    items: [
      "Pull-to-refresh sur mobile",
      "Animation du planning et des collections",
      "Swiper entre Ingrédients / Ustensiles / Étapes sur mobile",
      "Bouton de déconnexion en rouge, version depuis package.json",
    ],
  },
  {
    version: "1.0.1", label: "Stabilisation",
    items: [
      "Correction de l'édition de la Master DB",
      "Score de santé plafonné à 99",
      "Glissement vers le bas pour fermer les modals",
    ],
  },
  {
    version: "1.0.0", label: "Cardamome 🌿",
    items: [
      "Authentification Google, synchronisation Firebase Firestore",
      "Mode recette pas à pas (cook mode)",
      "Import / Export JSON (drag & drop)",
      "Planning repas & Inventaire Frigo",
    ],
  },
];
