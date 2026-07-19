# Changelog – Mijoté

## v3.4.0 – Safran · Import IA & calculatrices

### Nouvelle recette
- **Import depuis un lien** : colle l'URL d'une recette, l'IA (Claude Haiku) l'extrait et la met en forme (ingrédients, étapes à l'infinitif, liaisons ingrédients/ustensiles) — à relire avant d'enregistrer. Réservé au créateur, garde vérifiée **côté serveur**
- **Import depuis une photo** : photographie une recette de livre (jusqu'à **2 pages**), l'IA la reconstruit
- Sélecteur **« Nouvelle recette »** repensé : import par lien / photo (marqués IA) ou saisie manuelle
- Écran d'attente **volontairement non-annulable** pendant l'extraction (pour ne pas gâcher un crédit)

### Calculatrices dans la recette
- **Moule / plat** : adapte toutes les quantités au rapport de surfaces (ou de volumes) entre deux moules
- **Conversions d'unités** : masse ↔ volume via la densité de l'ingrédient de la recette

### Confort
- Retour d'une recette publique : on **revient sur la carte** consultée dans Découvrir (fini le retour tout en haut), sans clignotement
- **« L'ingrédient du moment »** reste visible pendant une recherche texte ; frise de saison plus aérée sur desktop et repère du mois courant soigné
- Bouton **Filtres** : survol desktop plus discret ; espacement des barres de filtre uniformisé entre Découvrir et Mes Recettes

## v3.3.0 – Safran · Découverte, filtres unifiés & PWA soignée

### Onboarding
- **Carrousel de bienvenue** à la première connexion : cartes défilables (peek gauche/droite) qui présentent les fonctionnalités clés

### Découvrir
- **« L'ingrédient du moment »** en tête de Découvrir : un fruit/légume de saison (rotation hebdomadaire), sa frise de saison, une accroche et les recettes publiques qui l'utilisent — ou une invitation à publier
- **Filtres unifiés avec Mes Recettes** : mêmes options exactement, via la même feuille de filtres

### Filtres avancés (Mes Recettes & Découvrir)
- **Feuille de filtres** repensée façon « Mob » : sections repliables, tri intégré
- Filtrer par **type**, **temps total**, **régime & saison**, **cuisine**, **Nutri-Score**, **difficulté**, **mode de cuisson** (four, air fryer, plaques… déduit des ustensiles, « mixte » si plusieurs) et **ingrédients** (multi-sélection avec vignettes)
- Bouton **Filtres** avec surbrillance élégante au survol sur desktop

### Badges
- Nouveau badge **Vegan** (ni viande, ni poisson, ni produits laitiers) ; le badge **De saison** est relooké (icône soleil / ambre)

### Foyer
- **Départ / dissolution** d'un foyer : les recettes créées dans le foyer ne disparaissent plus (fusion additive dans l'espace perso) et l'état vécu est conservé — plus de vieille liste de courses qui « ressuscite »
- **Retrait du partage de listes de courses** individuel : le mode foyer couvre déjà ce besoin, de façon plus cohérente

### PWA
- **Icônes d'application nettes** (fini le SVG pixellisé à l'ajout à l'écran d'accueil) : icônes PNG dédiées (dont une version *maskable*) + manifeste d'application
- Zoom et sélection de texte désactivés en mode **standalone** uniquement (feel natif sans gêner le navigateur)

### Sous le capot
- **Coûts Firestore** : l'annuaire des utilisateurs (avatars) n'est plus chargé pour tout le monde à chaque session — chargement **à la demande** (foyer, invitations), les utilisateurs solo ne le lisent jamais

## v3.2.1 – Poivre · Correctifs & améliorations

- **Difficulté** : le badge de la fiche devient **cliquable** et détaille le calcul (geste dominant, gestes détectés, modificateurs) ; le score **hérite désormais des gestes des préparations de base** d'une recette
- **Techniques** (Config) : catégories **repliables**, repliées par défaut, comme les Ingrédients
- **Ustensiles** : un ustensile ajouté sans `id` en reçoit un **automatiquement** (comme les techniques) – sûr côté seed, sans impact sur les recettes liées
- **Mes Recettes** : état vide **accueillant** à la première connexion, et recherche sans résultat plus soignée
- **Confort mobile** : retour tactile enfin visible sur les **cartes animées** (cartes recette, alertes courses/stock, repas du jour) ; le swipe-to-close d'une feuille respecte le scroll interne

## v3.2.0 – Poivre · Difficulté, partage & confort mobile

### Difficulté des recettes
- **Glossaire des techniques enrichi** : 63 gestes culinaires classés par famille, chacun avec une **difficulté (1–5)** – de « ciseler » à « tempérer le chocolat »
- **Gestion des techniques dans l'app** (admin) : ajout / édition / suppression d'un geste directement dans l'interface, comme les ingrédients, en plus de l'import/export YAML
- **Score de difficulté** d'une recette, estimé à partir des gestes repérés dans ses étapes (max des difficultés + modificateurs : nombre de gestes, préparations de base, longueur) – affiché en **badge dans la fiche**, avec le détail des gestes qui le tirent

### Partage
- **Feuille de partage** repensée : aperçu de la recette + **copier le lien**, **WhatsApp**, **SMS** et partage natif de l'appareil

### Confort mobile
- **Retour tactile** façon app native : les éléments s'assombrissent/rétractent sous le doigt ; les lignes d'ingrédients s'éclaircissent progressivement à l'appui maintenu
- **Collapse du hero** de la fiche recette **progressif et lié au scroll** (dans les deux sens), sans à-coup
- Suppression du contour bleu au tap, bulle de technique qui ne déborde plus

### Accueil & recettes
- Carte **Foyer** en tête de l'Accueil, épurée (liseré accent) ; salutation **Bonjour / Bonsoir**
- Carrousels **Découverte** et squelettes de chargement alignés sur **2 cartes** dans la largeur, comme la grille
- **Tri** des recettes en *segmented control* distinct des filtres
- **Astuces d'étape** redessinées (icône dédiée, une ligne) dans l'app **et le PDF**
- Éditeur : styles de cuisine allégés, **icône de carnet** sur les pills

### Planning
- Export **Agenda** (renommé, plus clair que « .ics ») ; en foyer, les membres sont ajoutés comme **participants** aux repas

### Sous le capot
- Structure du code clarifiée : `screens/` → `pages/` (suffixes `*Page`), quelques renommages de cohérence

## v3.1.0 – Cardamome · Foyer partagé & communauté de mijoteurs

### Foyer partagé
- **Créer un foyer** (jusqu'à 2 personnes) : recettes, stock, listes de courses et planning deviennent **communs** aux membres, synchronisés en temps réel
- **Espace actif unique** : on cuisine soit en solo, soit dans un foyer – en rejoignant un foyer, tes recettes y sont **ajoutées** (fusion additive) et planning/stock/courses du foyer sont adoptés ; ta **version personnelle reste sauvegardée** et redevient active en quittant
- **Préférences personnelles** conservées hors du partage
- **Inviter** depuis l'annuaire des utilisateurs déjà connectés à Mijoté (avec avatars), **gérer** le foyer (créer, inviter, quitter, dissoudre) et **message de bienvenue** à l'arrivée dans un foyer
- **Repères visuels** : carte Foyer en tête de l'Accueil et pastille foyer sur l'avatar quand le partage est actif
- **Export agenda** du planning : en foyer, les membres sont ajoutés comme **participants** aux repas

### Couche de données & glossaire des techniques
- **Techniques en contexte dans le pas-à-pas** : en mode cuisson, les gestes du glossaire (suer, déglacer, monter au beurre…) sont **mis en évidence dans le texte de l'étape** ; un survol (ordinateur) ou un appui (mobile) affiche leur définition
- **Données versionnées dans le repo** : la base de référence (ingrédients, ustensiles, techniques) a désormais une source de vérité lisible en YAML sous `data/` – plus simple à éditer et à relire que les constantes
- **Import en YAML, export en Markdown** : dans la Configuration, l'import des bases se fait par fichier **YAML** (validation stricte, import annulé en entier à la moindre erreur) ; l'export reste un tableau **Markdown** lisible
- **Glossaire des techniques** : nouvelle section **Techniques** (suer, déglacer, monder, émulsionner…) – gestes culinaires classés par famille (découpe, cuisson, liaison, préparation, dressage), avec définition et formes du verbe ; socle du futur survol des verbes en mode pas-à-pas
- **Préparations de base d'Escoffier** : un jeu de bases fondamentales (sauces mères Béchamel, Velouté, Espagnole, Tomate ; roux, fond brun, farce mousseline) pré-publiées sous le compte officiel **« Mijoté × Escoffier »**, à découvrir et à cloner – d'après *Le Guide Culinaire* (1903, domaine public), adapté à l'échelle domestique
- **Script de seed** (`npm run seed`) pour pousser ces données vers le cloud

### Recettes publiques (communauté)
- **Publier une recette** : depuis son menu, « Rendre publique » la partage avec la communauté ; « Rendre privée » la retire
- **Publication en cascade** : les préparations de base d'une recette sont publiées avec elle (confirmation explicite), pour que le partage reste complet
- **Découverte** dans l'Accueil : recherche (recette, chef, ingrédient) et filtres **par créateur, cuisine, de saison, Nutri-Score** et **selon tes préférences alimentaires**
- **Consultation complète avant de garder** : on ouvre la recette publique dans le même écran détaillé qu'en privé (ingrédients, ustensiles, étapes, Nutri-Score, attribution à l'auteur), en lecture seule, sur une **URL dédiée** `/discover/{auteur}__{recette}` (deep-linkable, retour navigateur)
- L'**Accueil** a maintenant sa route nommée `/home` (`/` y redirige)
- **Garder dans mes recettes** : clonage dans ta bibliothèque (avec ses bases), attribution à l'auteur et anti-doublon – la copie s'intègre à tout (planning, courses, stock, pas-à-pas) et reste modifiable

### Nouvel onglet Accueil
- **Page d'atterrissage repensée** : un vrai onglet **Accueil** distinct de « Mes Recettes »
- En-tête plus chaleureux : salutation personnalisée « Bonjour, {prénom} » sous-titrée d'un **« Bienvenue sur Mijoté »** de marque, sur un léger dégradé
- Bloc **« Aujourd'hui »** dérivé de tes données : recette planifiée ce midi/ce soir, articles de courses à acheter, ingrédients à racheter bientôt – réduit à un **bandeau fin** quand tout est à jour, pour laisser place à la découverte
- **Découverte façon feed** : rangées éditoriales **✨ À la une · 🌿 De saison · ❤️ Pour toi · 🍽️ Par cuisine** en navigation, grille filtrée complète dès qu'on cherche/filtre ; filtres **progressifs** (Nutri-Score & cuisines repliés), **avatar du créateur et date de publication** (« aujourd'hui », « il y a 2 jours »…) sous chaque carte, et léger survol

### Navigation & préférences
- La **Configuration** quitte la barre d'onglets et rejoint le menu **avatar** (5 onglets max, mobile comme desktop)
- Nouvelle section **Préférences alimentaires** (régime, allergènes, catégories à éviter, ingrédients non aimés), synchronisée dans le cloud

### Raffinements
- **Publier une recette** : confirmation explicite avant publication, icône **globe** plus parlante, encart « préparations de base incluses » redessiné
- **Découverte** : squelettes de chargement animés (au premier chargement et au rafraîchissement)
- **Mes Recettes** : tri regroupé en *segmented control* distinct des filtres (De saison, Cuisine), compteur de recettes aligné sur la ligne de base, espacement Carnets resserré
- **Éditeur de recette** : liste des styles de cuisine allégée, icône de carnet sur chaque pill
- **Confort mobile** : suppression du halo bleu au tap (PWA), bulle de définition d'une technique repositionnée pour ne plus déborder de l'écran
- **Navigation** : retour cohérent vers l'Accueil quand on ouvre depuis la Découverte une recette qu'on a publiée

## v3.0.0 – Tonka · Journal d'itérations & Raffinements

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

## v2.2.0 – Safran · Saisonnalité & Conseils Ingrédients

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

## v2.0.0 – Safran · Industrialisation & Architecture

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

## v1.0.7 – Nutrition & Ingrédients

- Score de santé amélioré : pondération des nutriments et intégration du Nutri-Score
- Export PDF revu et amélioré
- Section détaillée sur les apports nutritionnels dans le détail d'une recette
- Page dédiée par ingrédient
- Navigation directe vers la page d'un ingrédient depuis la liste des ingrédients d'une recette
- Refonte du menu recette sur mobile
- Validation du schéma JSON
- Corrections de bugs d'interface
- Mode master : export de la liste des ingrédients (nom, aliases, dbid, catégorie) en table Markdown

## v1.0.6 –  Navigation & Corrections

- Routage URL complet : chaque recette a son propre lien `/recipes/id`
- Écran de chargement animé avec spinner après connexion Google
- En-tête fixe dans le détail d'une recette lors du scroll
- Suppression du mode "Mois" dans le planning
- Animations d'entrée sur toutes les pages (Frigo, Courses, etc.)
- Sélecteur d'ustensiles moderne avec images et recherche dans le formulaire recette
- Bandeau "Mode Lecture" dans la configuration (ingrédients & ustensiles)
- Pills "Master" colorées en violet en mode lecture
- Notifications toast avec icône (succès ✓, erreur ✕) et animation corrigée

## v1.0.5 – Simplification & Partage

- Courses : tri par catégorie + ordre alphabétique par défaut, suppression des filtres manuels
- Catégorie "Pris" renommée "Acheté" et déplacée en bas
- Icône poubelle rouge dans les listes de courses
- Bouton "Ajouter un article" remonté en haut de liste
- Mode desktop : liste de courses pleine largeur avec switch dédié
- Limite de 200 caractères par article de liste
- Badge "Hors ligne" orange / vert selon l'état de synchronisation Firebase
- Config ustensiles : 3–4 cards par ligne sur desktop, tri alphabétique
- Partage de liste de courses (version alpha)

## v1.0.4 – Mode Courses & Frigo

- Courses : coller une liste séparée par des sauts de ligne (format tirets)
- Réorganisation alphabétique et par catégories des articles
- Passage dans "Acheté" fluide (animation)
- Modification et suppression individuelles d'articles
- Recherche Frigo identique aux autres pages
- Correction de l'affichage mobile du mode pas à pas + ustensiles intégrés
- Chargement des images accéléré (cache navigateur)
- Fond blanc systématique pour les images ingrédients et ustensiles
- Onglets ingrédients / ustensiles avec compteurs et scroll intelligent

## v1.0.3 – PDF & Qualité

- Parsing des pluriels amélioré (quantités, unités)
- Nombre d'ingrédients affiché sur chaque carte de recette
- Indicateur du nombre d'éléments dans la Master DB
- PDF : marges réduites, image principale incluse, sauts de page gérés
- Limite maximale de 24 portions

## v1.0.2 – UX & Animations

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

## v1.0.1 – Stabilisation

- Correction de l'édition de la Master DB (ingrédients et ustensiles)
- Score de santé plafonné à 99 (jamais 100 par construction)
- Nom Google affiché en majuscules
- Thème clair/sombre déplacé dans le menu profil
- Transition animée à l'ouverture d'une recette (mobile et desktop)
- Swiper entre Ingrédients / Ustensiles / Étapes sur mobile
- Correction du bouton "Tous" en mode clair dans Mon Frigo
- Hauteur des titres uniformisée sur mobile
- Glissement vers le bas pour fermer les modals (planning, courses, frigo, suppression)

## v1.0.0 – Cardamome 🌿

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
