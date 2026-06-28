# Changelog — Mijoté

## Non publié — Accueil & communauté de mijoteurs

### Couche de données & glossaire des techniques
- **Données versionnées dans le repo** : la base de référence (ingrédients, ustensiles, techniques) a désormais une source de vérité lisible en YAML sous `data/` — plus simple à éditer et à relire que les constantes
- **Import en YAML, export en Markdown** : dans la Configuration, l'import des bases se fait par fichier **YAML** (validation stricte, import annulé en entier à la moindre erreur) ; l'export reste un tableau **Markdown** lisible
- **Glossaire des techniques** : nouvelle section **Techniques** (suer, déglacer, monder, émulsionner…) — gestes culinaires classés par famille (découpe, cuisson, liaison, préparation, dressage), avec définition et formes du verbe ; socle du futur survol des verbes en mode pas-à-pas
- **Préparations de base d'Escoffier** : un jeu de bases fondamentales (sauces mères Béchamel, Velouté, Espagnole, Tomate ; roux, fond brun, farce mousseline) pré-publiées sous le compte officiel **« Mijoté × Escoffier »**, à découvrir et à cloner — d'après *Le Guide Culinaire* (1903, domaine public), adapté à l'échelle domestique
- **Script de seed** (`npm run seed`) pour pousser ces données vers le cloud

### Recettes publiques (communauté)
- **Publier une recette** : depuis son menu, « Rendre publique » la partage avec la communauté ; « Rendre privée » la retire
- **Publication en cascade** : les préparations de base d'une recette sont publiées avec elle (confirmation explicite), pour que le partage reste complet
- **Découverte** dans l'Accueil : recherche (recette, chef, ingrédient) et filtres **par créateur, cuisine, de saison, Nutri-Score** et **selon tes préférences alimentaires**
- **Consultation complète avant de garder** : on ouvre la recette publique dans le même écran détaillé qu'en privé (ingrédients, ustensiles, étapes, Nutri-Score, attribution à l'auteur), en lecture seule, sur une **URL dédiée** `/discover/{auteur}__{recette}` (deep-linkable, retour navigateur)
- L'**Accueil** a maintenant sa route nommée `/home` (`/` y redirige)
- **Garder dans mes recettes** : clonage dans ta bibliothèque (avec ses bases), attribution à l'auteur et anti-doublon — la copie s'intègre à tout (planning, courses, stock, pas-à-pas) et reste modifiable

### Nouvel onglet Accueil
- **Page d'atterrissage repensée** : un vrai onglet **Accueil** distinct de « Mes Recettes »
- En-tête plus chaleureux : salutation personnalisée « Bonjour, {prénom} » sous-titrée d'un **« Bienvenue sur Mijoté »** de marque, sur un léger dégradé
- Bloc **« Aujourd'hui »** dérivé de tes données : recette planifiée ce midi/ce soir, articles de courses à acheter, ingrédients à racheter bientôt — réduit à un **bandeau fin** quand tout est à jour, pour laisser place à la découverte
- **Découverte façon feed** : rangées éditoriales **✨ À la une · 🌿 De saison · ❤️ Pour toi · 🍽️ Par cuisine** en navigation, grille filtrée complète dès qu'on cherche/filtre ; filtres **progressifs** (Nutri-Score & cuisines repliés), **avatar du créateur et date de publication** (« aujourd'hui », « il y a 2 jours »…) sous chaque carte, et léger survol

### Navigation & préférences
- La **Configuration** quitte la barre d'onglets et rejoint le menu **avatar** (5 onglets max, mobile comme desktop)
- Nouvelle section **Préférences alimentaires** (régime, allergènes, catégories à éviter, ingrédients non aimés), synchronisée dans le cloud

## v3.0.0 — Tonka · Journal d'itérations & Raffinements

### Journal d'itérations
- **Figer une version** d'une recette à chaque retravail : note de dégustation (/10) et commentaire libre
- Visualisation **diff « git »** entre deux versions : ingrédients, ustensiles et étapes *ajoutés*, *retirés* ou *modifiés* d'un coup d'œil
- Comparaison libre : choisir n'importe quelle version (ou la recette actuelle) comme base de comparaison
- Liste des itérations en **timeline** verticale (date & heure), commentaires en style citation avec avatar

### Design & ergonomie
- Nouvelle police de texte **Hanken Grotesk** pour un rendu plus élégant
- Menu d'actions desktop modernisé (dock animé) et menu recette « ⋯ » avec animation d'ouverture/repliement fluide
- Partage du lien d'une recette depuis le menu
- Sélecteurs de quantité (`-` / `+`) unifiés et correctement alignés sur mobile et desktop
- Modale **Préparations de base** repensée (principes de composition, fermeture au clic extérieur / swipe)

### PDF & divers
- Pied de page PDF enrichi : date de génération, badge de version, source
- Changelog : rendu du Markdown formaté (**gras**, *italique*, `code`)

## v2.2.0 — Safran · Saisonnalité & Conseils Ingrédients

### Saisonnalité des recettes
- Calendrier saisonnier par ingrédient (France métropole, mois 1-12), éditable dans la fiche ingrédient
- Filtre **🌱 De saison** dans la liste des recettes : affiche uniquement les recettes dont ≥ 50 % des ingrédients saisonniers sont de saison ce mois-ci
- Indicateur de saisonnalité dans la fiche ingrédient : bandeau 12 mois colorés + badge "De saison / Hors saison"
- Colonne `Mois` dans l'export/import Markdown de la base d'ingrédients (round-trip fidèle, format `1-3,11-12`)
- Sélecteur de mois dans l'éditeur d'ingrédient (pour les catégories : légume, fruit, herbes, champignon)

### Conseils ingrédients (Tips)
- Section **Tips utiles** dans la fiche ingrédient, avec 5 catégories : 🔪 Préparation, 🛒 Choix & conservation, 🍳 Utilisation, ❄️ Congélation, 💡 Astuce anti-gaspi
- Design restylé : icône en pastille colorée arrondie, ordonnancement automatique par catégorie
- Colonne `Tips` dans l'export/import Markdown (format `type: texte ;; type: texte`)
- Détail par nutriment (barres + % AJR) replié par défaut sous le graphique donut
- Base pré-remplie de 47 ingrédients saisonniers (légumes, fruits, herbes, champignons)

### Divers
- Champ « Poids moyen d'une pièce » de l'éditeur d'ingrédient affiche le suffixe `g`

## v2.0.0 — Safran · Industrialisation & Architecture

- Refonte complète de l'architecture : le fichier monolithe `App.jsx` (6000+ lignes) éclaté en une structure en couches (61 fichiers)
- Couche logique métier isolée et découplée de l'interface : Nutri-Score, rapprochement d'ingrédients, parsing, import et export PDF/JSON
- Synchronisation Firebase regroupée dans un hook dédié (auth, chargement, sauvegardes, partage temps réel)
- Contexte applicatif partagé : fin du passage en cascade des infos de session, thème et notifications à travers les écrans
- Styles extraits dans une feuille CSS dédiée
- Écrans de connexion et de chargement isolés en composants propres
- Changelog unifié : une seule source de vérité (`CHANGELOG.md`)
- Nettoyage du code mort et des fichiers de gabarit inutilisés
- Nouveau README complet (fonctionnalités, configuration, scripts, architecture)
- Aucune régression fonctionnelle : refonte purement interne

## v1.0.7 — Nutrition & Ingrédients

- Score de santé amélioré : pondération des nutriments et intégration du Nutri-Score
- Export PDF revu et amélioré
- Section détaillée sur les apports nutritionnels dans le détail d'une recette
- Page dédiée par ingrédient
- Navigation directe vers la page d'un ingrédient depuis la liste des ingrédients d'une recette
- Refonte du menu recette sur mobile
- Validation du schéma JSON
- Corrections de bugs d'interface
- Mode master : export de la liste des ingrédients (nom, aliases, dbid, catégorie) en table Markdown

## v1.0.6 —  Navigation & Corrections

- Routage URL complet : chaque recette a son propre lien `/recipes/id`
- Écran de chargement animé avec spinner après connexion Google
- En-tête fixe dans le détail d'une recette lors du scroll
- Suppression du mode "Mois" dans le planning
- Animations d'entrée sur toutes les pages (Frigo, Courses, etc.)
- Sélecteur d'ustensiles moderne avec images et recherche dans le formulaire recette
- Bandeau "Mode Lecture" dans la configuration (ingrédients & ustensiles)
- Pills "Master" colorées en violet en mode lecture
- Notifications toast avec icône (succès ✓, erreur ✕) et animation corrigée

## v1.0.5 — Simplification & Partage

- Courses : tri par catégorie + ordre alphabétique par défaut, suppression des filtres manuels
- Catégorie "Pris" renommée "Acheté" et déplacée en bas
- Icône poubelle rouge dans les listes de courses
- Bouton "Ajouter un article" remonté en haut de liste
- Mode desktop : liste de courses pleine largeur avec switch dédié
- Limite de 200 caractères par article de liste
- Badge "Hors ligne" orange / vert selon l'état de synchronisation Firebase
- Config ustensiles : 3–4 cards par ligne sur desktop, tri alphabétique
- Partage de liste de courses (version alpha)

## v1.0.4 — Mode Courses & Frigo

- Courses : coller une liste séparée par des sauts de ligne (format tirets)
- Réorganisation alphabétique et par catégories des articles
- Passage dans "Acheté" fluide (animation)
- Modification et suppression individuelles d'articles
- Recherche Frigo identique aux autres pages
- Correction de l'affichage mobile du mode pas à pas + ustensiles intégrés
- Chargement des images accéléré (cache navigateur)
- Fond blanc systématique pour les images ingrédients et ustensiles
- Onglets ingrédients / ustensiles avec compteurs et scroll intelligent

## v1.0.3 — PDF & Qualité

- Parsing des pluriels amélioré (quantités, unités)
- Nombre d'ingrédients affiché sur chaque carte de recette
- Indicateur du nombre d'éléments dans la Master DB
- PDF : marges réduites, image principale incluse, sauts de page gérés
- Limite maximale de 24 portions

## v1.0.2 — UX & Animations

- Entrée dans le mode pas à pas animée
- Zoom identique sur la page de connexion
- Couleur de sélection des éléments harmonisée
- Mise à jour du schéma JSON (suppression des champs obsolètes `description` / `title` dans les étapes)
- Pull-to-refresh sur mobile
- Animation du planning et des collections
- Listes de courses sans image (non liées à une recette)
- Bouton de déconnexion en rouge
- Version récupérée depuis `package.json`
- Avatars d'images améliorés

## v1.0.1 — Stabilisation

- Correction de l'édition de la Master DB (ingrédients et ustensiles)
- Score de santé plafonné à 99 (jamais 100 par construction)
- Nom Google affiché en majuscules
- Thème clair/sombre déplacé dans le menu profil
- Transition animée à l'ouverture d'une recette (mobile et desktop)
- Swiper entre Ingrédients / Ustensiles / Étapes sur mobile
- Correction du bouton "Tous" en mode clair dans Mon Frigo
- Hauteur des titres uniformisée sur mobile
- Glissement vers le bas pour fermer les modals (planning, courses, frigo, suppression)

## v1.0.0 — Cardamome 🌿

- Authentification Google avec avatar
- Synchronisation Firebase Firestore
- Mode recette pas à pas (cook mode)
- Recherche par ingrédient
- Inférences de quantités et unités
- Tags sans virgule
- Source de recette cliquable
- Import / Export JSON (drag & drop)
- Planning repas
- Inventaire Frigo
