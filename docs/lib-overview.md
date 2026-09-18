# Cardamome : Bibliothèque métier

Cette documentation est générée automatiquement à partir des annotations **TSDoc**
du dossier [`src/lib`](https://github.com/CDucloux/mijote/tree/main/src/lib) : le
cœur logique de l'application, entièrement typé et découplé de React.

L'organisation suit **13 domaines** (un dossier chacun) plus quelques modules
transverses à la racine. La barre latérale reflète cette arborescence.

## 🔥 `firebase/` : Infrastructure

Accès au backend Firebase et à l'authentification, sans logique métier.

| Module | Rôle |
| --- | --- |
| `firebase` | Initialisation du SDK (app, auth, firestore, storage, functions) |
| `auth` / `googleAuth` | Connexion Google (allowlist e-mail, repli redirection), déconnexion |
| `authErrors` / `signInFeedback` | Classification et messages des erreurs de connexion |
| `firestore` | Lecture/écriture des documents (recettes, planning, foyer…) |
| `storage` / `imageResize` | Upload d'images (compression ≤ 2000 px, URLs) |
| `subscription` | État d'abonnement Cardamome+ côté client |

## 🥕 `food/` : Ingrédients & alimentation

Tout ce qui touche aux ingrédients : rapprochement, saisonnalité, régimes, courses.

| Module | Rôle |
| --- | --- |
| `parseIngredient` | Analyse d'une ligne d'ingrédient (quantité, unité, nom) |
| `nameMatcher` | Rapprochement d'un nom saisi vers la base d'ingrédients |
| `seasonality` | Saisonnalité (mois de disponibilité) |
| `dietary` / `dietFilter` | Régimes alimentaires et filtrage |
| `calculators` | Conversions et calculs (portions, quantités) |
| `shoppingList` / `shoppingAggregate` | Liste de courses et agrégation par ingrédient |
| `stockShelves` | Pagination des étagères du stock |
| `qualityRecommendation` | Recommandations de qualité (bio, origine…) |
| `ingredientsMarkdown` | Rendu Markdown des ingrédients |

## 📅 `planning/` : Planning repas & batch cooking

Génération de semaine, mutualisation de la préparation, tableau de bord, minuteurs.

| Module | Rôle |
| --- | --- |
| `mealPlanner` | Auto-génération du planning (créneaux midi/soir) |
| `batchSession` | Session batch : mise en place mutualisée, cuissons regroupées |
| `composedMeal` | Repas composés (rôles, groupes) |
| `cookTimers` / `stepTimers` | Minuteurs de cuisson et découpage des durées d'étape |
| `cookingActivity` | Activité de cuisine (statistiques, historique) |
| `dashboard` | Données du tableau de bord d'accueil |
| `spotlight` | Mise en avant (ingrédient/recette du moment) |

## 📖 `recipes/` : Recettes

Le cœur : schéma, filtres, tri, difficulté, Nutri-Score, import IA, export PDF.

| Module | Rôle |
| --- | --- |
| `recipeSchema` | Schéma et normalisation d'une recette |
| `recipeActions` | Opérations (ajout aux courses, duplication…) |
| `recipeFilters` / `recipeSort` / `recipeGroups` | Filtrage, tri et regroupement de la bibliothèque |
| `recipeComponents` | Préparations de base (composants réutilisables) |
| `decoupe` | Postes de découpe (mise en place) |
| `difficulty` | Estimation de difficulté |
| `nutriscore` | Calcul du Nutri-Score |
| `cooking` / `techniques` | Méthodes de cuisson et gestes techniques |
| `history` | Journal d'itérations d'une recette |
| `recipeImport` / `importIdempotency` / `importInterruption` | Pipeline d'import et reprise idempotente |
| `recipeUrlImport` / `pdfImport` / `pdfText` | Extraction IA depuis URL, photos ou PDF |
| `recipePdf` | Export PDF |
| `discoverFeed` / `plan` | Feed Découverte et plan de recette |

## 🏠 `household/` : Foyer & partage

Espace partagé (foyer), migration, recettes publiques.

| Module | Rôle |
| --- | --- |
| `workspace` | Espace de travail (perso vs foyer) |
| `household` / `householdMigration` | Gestion du foyer (membres, invitations) et migration des données |
| `publicRecipes` | Publication / clonage de recettes communautaires |
| `dataYaml` | Sérialisation YAML (export/import de données) |

## 🎨 `ui/` : Interactions & feel natif

Logique pure derrière les micro-interactions et le comportement natif mobile
(gestes, scroll élastique, thème, transitions). Sans rendu React.

| Module | Rôle |
| --- | --- |
| `runtimeContext` / `nativeFeel` | Détection de plateforme et réglages du ressenti natif |
| `elasticStretch` / `elasticScrollCore` / `globalElasticScroll` | Scroll élastique (rebond) |
| `ripple` / `flingVelocity` / `dragReorder` | Ondulation, inertie, réorganisation par glisser |
| `heroCollapse` / `screenTransition` | Repli du hero et transitions d'écran |
| `themeColor` / `statusBarTheme` | Couleur de thème et barre de statut |
| `backButton` / `softKeyboard` / `appZone` | Bouton retour Android, clavier logiciel, zone applicative |
| `internalLink` / `imageLoad` / `tooltipPosition` | Liens internes, détection d'image chargée, placement des info-bulles |

## 🧭 Domaines spécialisés

| Dossier | Rôle |
| --- | --- |
| `cookSession/` | Barre de notification native du mode pas à pas (Android) : `plugin`, `snapshot` |
| `notifications/` | Notifications OS des minuteurs (`localNotifications`) et journal d'activité (`activity`) |
| `utensils/` | Ustensiles : appareils et paramètres (`appliances`), précautions d'usage (`usagePrecaution`) |
| `onboarding/` | Recette offerte aux non-abonnés (`giftRecipe`) |
| `landing/` | Contenu de la page d'accueil publique (`cta`) |
| `sources/` | Sources de recettes recommandées (`recommendedSources`) |
| `observability/` | Traces et métriques côté client (`observability`) |

## 🧰 Racine : Transverse

| Module | Rôle |
| --- | --- |
| `types` | Types de domaine partagés (Recipe, MealPlan, Collection…) |
| `format` | Formatage (dates, quantités, libellés) |
| `aiQuota` | Crédits d'import IA côté client (affichage du reliquat) |

---

> Documentation générée avec [TypeDoc](https://typedoc.org).
> Régénérer : `npm run doc`.
