# Cardamome : Bibliothèque métier

Cette documentation est générée automatiquement à partir des annotations **TSDoc**
du dossier [`src/lib`](https://github.com/CDucloux/mijote/tree/main/src/lib) : le
cœur logique de l'application, entièrement typé et découplé de React.

L'organisation suit **5 domaines** + quelques modules transverses à la racine.

## 🔥 `firebase/` : Infrastructure

Accès au backend Firebase, sans logique métier.

| Module | Rôle |
| --- | --- |
| `firebase` | Initialisation du SDK (app, auth, firestore, storage, functions) |
| `auth` | Connexion Google (allowlist e-mail, repli redirection), déconnexion |
| `firestore` | Lecture/écriture des documents (recettes, planning, foyer…) |
| `storage` | Upload d'images (compression, URLs) |
| `imageResize` | Redimensionnement des photos avant import IA (≤ 2000 px, JPEG) |

## 🥕 `food/` : Ingrédients & alimentation

Tout ce qui touche aux ingrédients : rapprochement, saisonnalité, régimes, courses.

| Module | Rôle |
| --- | --- |
| `parseIngredient` | Analyse d'une ligne d'ingrédient (quantité, unité, nom) |
| `nameMatcher` | Rapprochement d'un nom saisi vers la base d'ingrédients |
| `seasonality` | Saisonnalité (mois de disponibilité) |
| `dietary` / `dietFilter` | Régimes alimentaires et filtrage |
| `calculators` | Conversions et calculs (portions, quantités) |
| `shoppingAggregate` | Agrégation des lignes de courses par ingrédient |
| `ingredientsMarkdown` | Rendu Markdown des ingrédients |

## 📅 `planning/` : Planning repas & batch cooking

Génération de semaine, mutualisation de la préparation, tableau de bord.

| Module | Rôle |
| --- | --- |
| `mealPlanner` | Auto-génération du planning (créneaux midi/soir) |
| `batchSession` | Session batch : mise en place mutualisée par ingrédient, cuissons regroupées |
| `composedMeal` | Repas composés (rôles, groupes) |
| `cookingActivity` | Activité de cuisine (statistiques, historique) |
| `dashboard` | Données du tableau de bord d'accueil |
| `spotlight` | Mise en avant (ingrédient/recette du moment) |
| `stepTimers` | Minuteurs des étapes de cuisson |

## 📖 `recipes/` : Recettes

Le cœur : schéma, filtres, tri, difficulté, Nutri-Score, import IA, export PDF.

| Module | Rôle |
| --- | --- |
| `recipeSchema` | Schéma et normalisation d'une recette |
| `recipeActions` | Opérations (ajout aux courses, duplication…) |
| `recipeFilters` / `recipeSort` | Filtrage et tri de la bibliothèque |
| `recipeComponents` | Préparations de base (composants réutilisables) |
| `difficulty` | Estimation de difficulté |
| `nutriscore` | Calcul du Nutri-Score |
| `cooking` | Méthodes de cuisson (déduites des ustensiles) |
| `techniques` | Gestes techniques |
| `history` | Journal d'itérations d'une recette |
| `recipeImport` | Pipeline d'import (dbId, Nutri-Score, purge ustensiles) |
| `recipeUrlImport` | Extraction IA depuis une URL ou des photos |
| `recipePdf` | Export PDF |

## 🏠 `household/` : Foyer & partage

Espace partagé (foyer), migration, recettes publiques.

| Module | Rôle |
| --- | --- |
| `workspace` | Espace de travail (perso vs foyer) |
| `household` | Gestion du foyer (membres, invitations) |
| `householdMigration` | Migration des données vers un foyer |
| `publicRecipes` | Publication / clonage de recettes communautaires |
| `dataYaml` | Sérialisation YAML (export/import de données) |

## 🧰 Racine : Transverse

| Module | Rôle |
| --- | --- |
| `types` | Types de domaine partagés (Recipe, MealPlan, Collection…) |
| `format` | Formatage (dates, quantités, libellés) |

---

> Documentation générée avec [TypeDoc](https://typedoc.org).
> Régénérer : `npm run doc`.
