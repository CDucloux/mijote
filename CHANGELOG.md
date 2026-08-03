# Changelog – Mijoté

## v3.9.8 – Safran · Gestes & finitions

### Planning
- **Accès à la session batch repensé** : l'ancien bouton d'en-tête (qui repoussait le titre sur deux lignes) laisse place à une bannière contextuelle claire en tête de semaine, affichée seulement quand il y a des plats à cuisiner

### Import de recettes
- **Quantités d'épices en grammes** : l'import IA n'emploie plus l'unité imprécise « pincée » — les épices, le sel et le poivre (même « au goût ») sont estimés en grammes *(effectif après mise à jour du serveur)*

### Gestes & mobile
- **Fermeture au doigt fluide** : glisser une fenêtre vers le bas la fait maintenant filer proprement jusqu'en bas, sans le petit sursaut où elle remontait avant de redescendre
- **Effet élastique généralisé** : le rebond discret en bas de liste (déjà présent sur les recettes) s'applique désormais au Planning, aux Courses, au Stock et à Mes recettes — et il est plus subtil sur la fiche recette

## v3.9.7 – Safran · Documentation & barre du bas

### Documentation
- **Documentation technique publiée** : la bibliothèque métier (`src/lib`, 40 modules / 187 fonctions) est désormais générée en site statique via TypeDoc et publiée sur GitHub Pages à chaque mise à jour

### Interface mobile & PWA
- **Barre de navigation système au thème** : en PWA installée, la barre du bas (gestes Android / indicateur iOS) prend la couleur de l'appli au lieu de la couleur système — la barre d'onglets peint désormais la zone système sous elle

## v3.9.6 – Safran · Import & finitions mobiles

### Import de recettes
- **Pages d'import repensées** : l'import par lien et par photo passent en pages plein écran dédiées (adresses propres `/recipes/import-from-url` et `/recipes/import-from-picture`), navigables et partageables
- **Coller le lien copié** : si un lien de recette est dans le presse-papiers, un bouton le propose en un tap
- **Partage vers Mijoté** : partage une page depuis ton navigateur (feuille de partage du système) et la recette arrive directement dans l'import, le lien pré-rempli — il ne reste qu'à confirmer *(PWA installée)*

### Interface mobile & PWA
- **Onglet actif en surbrillance** : la barre du bas met en évidence l'onglet sélectionné par une pastille derrière l'icône
- **Barres système au thème de l'appli** : en PWA installée, les barres du haut et du bas suivent le thème clair/sombre de Mijoté (et non celui du système), sans clignotement au lancement

## v3.9.5 – Safran · Détails soignés

### Connexion
- **Écran « Connexion en cours… » toujours visible** : après une connexion, l'écran de chargement s'affiche désormais au moins une seconde — fini le flash imperceptible quand la session est déjà en cache. Sans effet quand on rouvre l'app déjà connecté (aucun délai inutile)

### Fenêtres modales
- **Animation de sortie sur « Annuler »** : les boutons « Annuler » des fenêtres jouent maintenant la même animation de fermeture que le glissé ou le clic sur le fond, au lieu de disparaître d'un coup (planning, courses, carnets, profil, fiche recette, configuration…)
- **Déconnexion harmonisée** : la fenêtre de confirmation de déconnexion adopte le style commun (animation d'entrée et de sortie, focus sur « Annuler », fermeture par Échap)

## v3.9.4 – Safran · Connexion isolée

### Corrections
- **Récap de session batch honnête** : le récap comptait des items là où il fallait compter des créneaux — il affiche désormais le vrai nombre de **repas couverts** (créneaux date × midi/soir distincts) et de **cuissons** (seuls les plats qui cuisent réellement)
- **Glissement du toggle de thème** : sur la page d'accueil, la bascule clair / sombre passe désormais **progressivement** d'un état à l'autre au lieu de sauter

### Sous le capot
- **Module d'authentification dédié** : toute la logique de connexion Google (allowlist, repli sur redirection, déconnexion) est sortie d'`App.jsx` vers `lib/firebase/auth.ts` (découplé de React) et un hook `useAuthUser` — `App.jsx` ne manipule plus le SDK Firebase Auth directement
- **Route `/login` dédiée** : l'écran de connexion a désormais sa propre route publique, séparée des routes protégées ; à la déconnexion, la page précédente n'est plus laissée montée derrière, et à la reconnexion on revient à la dernière page consultée
- Aucun changement fonctionnel visible : réorganisation interne pour la maintenabilité

## v3.9.3 – Safran · Correctifs

- **Bascule clair / sombre réparée** : le changement de thème ne fonctionnait plus (ni sur la page d'accueil, ni dans l'app) — corrigé
- **Session batch ré-ouvrable** : un bouton dédié dans l'en-tête du planning permet de rouvrir la session batch à tout moment (plus seulement juste après une génération)
- **Mise en place ciblée** : la préparation mutualisée ne liste plus que les **légumes et herbes aromatiques** (les seuls produits frais dont la découpe se mutualise vraiment)

## v3.9.2 – Safran · Batch cooking mutualisé

### Planning
- **Choix des créneaux à générer** (Midi / Soir) dans l'auto-génération de la semaine — décoche « Midi » quand tu manges à la cantine, l'appli ne remplit alors que le soir. Choix mémorisé d'une semaine à l'autre

### Batch cooking repensé
- **Mise en place mutualisée** : tous les ingrédients de la semaine, toutes recettes confondues, **regroupés et sommés par ingrédient** (« prépare tous les oignons d'un coup ») — classés par catégorie, avec le **geste de préparation**, l'**estimation en pièces** (« 500 g d'oignons · ~5 ») et une **checklist cochable**
- **Cuissons à mutualiser** : les plats qui partagent le même appareil (four, plaques…) sont regroupés — on n'allume le four qu'une fois
- **Récap de session** : nombre d'ingrédients à préparer, de cuissons et de repas couverts

## v3.9.1 – Safran · TypeScript de bout en bout

### Sous le capot
- **Fin de la migration TypeScript** : tout `src/lib` (37 modules) et tous les hooks (21) sont désormais typés — y compris `firebase`/`firestore` et la couche de synchronisation
- **Réorganisation de `src/lib`** en 5 sous-dossiers (`firebase/`, `recipes/`, `food/`, `planning/`, `household/`) + alias de chemin `@/` (imports stables et lisibles)
- **Types de domaine partagés** (`lib/types.ts`) : fin des variantes redondantes de « recette » et de « ligne d'ingrédient »
- Documentation TSDoc homogène (`@param`/`@returns`) sur les fonctions exposées
- Aucun changement fonctionnel : fiabilisation interne (le typage a permis de corriger quelques frontières de données au passage)

## v3.9.0 – Safran · Fenêtres animées & courses affûtées

### Fenêtres & animations
- **Animation de sortie** sur toutes les fenêtres modales et alertes (fini la disparition sèche), avec un **timing d'entrée** retravaillé (feuilles et alertes)
- **Liens légaux** de la page d'accueil (CGU, Politique de confidentialité) en **surbrillance au survol** sur desktop

### Courses
- **Options de liste intégrées à la pastille active** (le « ⋯ » n'apparaît que sur la liste sélectionnée) et **appui long** pour modifier ou supprimer une liste
- **Hauteur des pastilles uniformisée** — fini les pastilles de tailles inégales

### Import photo
- **Extraction sur Sonnet 5** en **haute résolution** : lecture bien plus fidèle des pages de livre (moins d'oublis, moins d'erreurs de lecture)
- **Prompt dédié aux photos** (mise en page en colonnes, deux pages, aplatissement des groupes d'ingrédients)
- **Détection de la photo du plat** parmi les pages fournies → utilisée automatiquement en **image de couverture**

### Thème & affichage
- Bascule **clair / sombre fluide** sur les pages denses (accueil, recettes, stock)
- **Éditeur** : les unités des ingrédients liés ne collent plus à la quantité et le **pluriel** est appliqué correctement

### Sous le capot
- **Migration TypeScript** de `src/lib` quasi terminée (planificateur, courses batch, foyer, import/export, PDF, recettes publiques, stockage…) — il ne reste que `firebase` et `firestore`

## v3.8.6 – Safran · Imports fiables & finitions

### Import IA (lien & photo)
- **Import photo réparé** : les photos sont redimensionnées avant l'envoi — fini l'erreur « deadline-exceeded » sur les grandes images
- **Recettes en anglais traduites** automatiquement, avec **conversions impériales** (oz, lb, cup, °F, pouces) vers le métrique et un jeu d'**unités normalisé**
- **Extraction plus fidèle** : aucun ingrédient oublié, noms au singulier **sans le mot de mesure** (« gousse d'ail » → nom « ail », unité « gousse »), et l'unité implicite « pièce » n'encombre plus (« 1 oignon », pas « 1 pièce oignon »)
- **Erreurs claires** : les échecs d'import s'affichent en **popup** (message + origine) et les hints de saisie (URL invalide…) dans un **bandeau soigné**, plus de texte rouge brut

### Mes recettes
- **Menus d'appui long repensés** (recette & carnet) : en-tête soigné, **actions rapides** (Ouvrir, Planning, Courses, Carnet / Dupliquer, Partager) et **position du carnet** au sélecteur
- **État « aucune recette »** devenu utile : chercher le plat **dans la communauté**, le **créer** d'un geste, ou réinitialiser
- L'**appui long** s'annule dès que le doigt bouge (fin du conflit avec le pull-to-refresh)
- **Accès direct à l'éditeur** via l'URL `/recipes/:id/edit`

### Suppressions & fenêtres
- **Confirmations de suppression unifiées** en **dialogue centré** (fini le tiroir qu'on balaie par mégarde), même look partout
- Plus d'écran **« recette introuvable »** qui clignote juste après une suppression
- **Fenêtre hors ligne** au tutoiement et raccord au reste de l'app

### Planning
- Un repas dont la **recette a été supprimée** n'affiche plus un bouton « Compléter » fantôme sur un créneau vide

### Affichage & cuisine
- **Pluriel** des unités et des noms d'ingrédients comptables (« 2 gousses », « 4 œufs »)
- **Repérage des techniques sensible aux accents** (« grillé » ≠ « grille », « glacé » ≠ « glace »)

### Sous le capot
- Poursuite de la **migration TypeScript** de `src/lib` (formats, tri, courses, techniques, Nutri-Score, saisonnalité, régimes…) et regroupement des tests

## v3.8.5 – Safran · Gestes élastiques

### Fiche recette (mobile)
- En haut de page, le **pull-to-refresh** reprend la main : l'effet de zoom du hero (qui entrait en conflit avec l'image) est retiré

### Mode pas à pas
- Le contenu des étapes gagne un **rebond élastique** en haut et en bas (en plus du swipe pour changer d'étape)

### Courses
- **Overscroll « stretch »** de la rangée de listes : en atteignant le début ou la fin, les pills se décalent légèrement puis reviennent en ressort (comme sur WhatsApp / Maps)

## v3.8.4 – Safran · Fiche recette & mode cuisine

### Fiche recette (mobile)
- **Repli du hero repensé** : image en parallaxe qui monte légèrement en échelle, départ étagé des éléments (badges, puis source, puis titre), et barre compacte qui ne se voile qu'une fois le hero replié. Défilement plus fluide (piloté image par image, sans re-rendu de la page)
- **Rubber band** : léger zoom du hero quand on tire vers le bas en haut de page, rebond élastique en bas de chaque onglet
- **Retour au toucher** soigné sur les boutons, pills, steppers et lignes d'ingrédient (le compteur de portions rebondit)
- Bouton **« Planifier »** en blanc, aligné sur « Courses »

### Mode pas à pas
- **Porté par l'URL** (`/recipes/:id/cookmode`) : il survit à un dézoom sur desktop, se ferme au bouton retour du navigateur et devient partageable
- **Navigation au swipe** (mobile) : glisser à gauche pour l'étape suivante, à droite pour la précédente

### Accessibilité
- Prise en compte de **« mouvement réduit »** (prefers-reduced-motion) : animations et effets élastiques neutralisés

### Sous le capot
- Amorce de la **migration TypeScript** (chaîne de types + vérification, premier module de logique migré)

## v3.8.3 – Safran · Recherche, courses & cuisine

### Recherche & tri
- **Barre de recherche** redessinée (pilule blanche, halo au focus, touche Entrée = loupe) sur **Mes recettes**, **Découvrir**, **Stock** et le sélecteur d'ustensiles
- **Tri simple** par défilement : un clic fait défiler les critères (**Récent, A → Z, Nutri-Score, Temps, Difficulté**) avec choix du **sens** ; le tri quitte le panneau de filtres

### Courses
- Nouvel onglet **« Toutes les courses »** : fusionne toutes les listes en une seule liste dédupliquée par ingrédient, **quantités sommées** quand l'unité le permet (« Citrons ×4 »), avec la **provenance** (« Pour X + Y »). Cocher un article le marque acheté dans toutes les listes d'origine

### Mode cuisine
- **Navigation au clavier** (desktop) : flèches ← / → pour parcourir les étapes
- **Minuteurs automatiques** : les mentions de temps d'une étape (« 6 min », « 1 h 30 »…) deviennent des minuteurs en un clic, avec compte à rebours flottant (pause / stop), bip et vibration à la fin
- **Fermeture animée** du mode pas à pas

### Ustensiles & finitions
- **Remplacer un ustensile** en un geste dans l'éditeur (pratique après un import IA)
- **Titre d'onglet** du navigateur = nom de la recette consultée
- Boutons d'action principaux (« Nouvelle », « Générer », « Nouvelle liste ») harmonisés en pilule ; renommage interne « fridge » → **stock**

### Sous le capot
- **Grille de recettes plus fluide** au défilement (mémoïsation, images en chargement différé, fin du scroll saccadé)

## v3.8.2 – Safran · Confort & finitions

### Recettes & carnets
- **Menu contextuel** sur une recette (appui long sur mobile, clic droit sur desktop) : **Modifier** ou **Supprimer**
- **Confirmation** systématique avant de supprimer une recette **ou** un carnet
- **Carnets réordonnables** : glisser-déposer (desktop) ou flèches « gauche / droite » (mobile) ; l'ordre est mémorisé
- **Carnet, tri et filtres mémorisés** au rechargement de la page (mobile & web)

### Cuisine & planning
- À la fin du **mode cuisine**, un bouton **« Noter une itération »** (note du résultat + notes de dégustation) alimente directement le **carnet d'itérations**
- Planifier une recette depuis sa fiche crée désormais un **vrai repas** (avec rôle), donc complétable comme un repas composé

### Affichage
- **Quantités en fractions** lisibles (½, ¼, ¾…) qui évoluent avec les portions ; l'**unité est décollée** de la quantité (« 1 gousse », « 20 ml »), les grammes restant collés
- **Images d'ustensiles** correctement cadrées (plus de rognage), dans l'app **et** le PDF

### Sous le capot
- Refonte interne (App découpé en hooks de domaine), nettoyage progressif des styles, correctifs console et intégration continue enrichie (lint)

## v3.8.1 – Safran · Correctifs

- **Mes recettes** : tri par défaut sur les **plus récentes** (au lieu de A → Z) — plus simple pour retrouver ce qu'on vient d'ajouter. Le dernier ajout apparaît bien en tête, même parmi les recettes du même jour. Les tris A → Z et Santé restent disponibles.

## v3.8.0 – Safran · Sécurité & synchronisation

### Sécurité
- **Protection anti-scraping** : attestation d'origine des requêtes (**App Check**) et lecture de la base durcie (requêtes bornées, e-mail vérifié requis) pour éviter l'aspiration des données

### Synchronisation
- Base d'**ingrédients / ustensiles / techniques** synchronisée **en temps réel** entre appareils : les mises à jour arrivent sans avoir à recharger

### Planning
- Le créneau **Petit-déjeuner** est masqué par défaut : seuls **Midi** et **Soir** s'affichent tant que rien n'y est prévu
- Message clair quand la **bibliothèque est vide** (au lieu de « semaine déjà remplie »)

### Export PDF
- Une **étape** n'est plus **coupée** entre deux pages

### Sous le capot
- **Import IA** : récupération fiable des ustensiles cités dans les étapes
- Grand nettoyage du code (variables inutilisées, configuration du linter)

## v3.7.0 – Safran · Informations légales & finitions

### Informations légales (RGPD)
- Nouvelle section **Informations légales** dédiée : **Mentions légales**, **Politique de confidentialité**, **CGU** et **Politique de cookies**, rédigées en Markdown (liens, titres, gras)
- Accès depuis la **sidebar** (desktop), le **menu avatar** (mobile) et une ligne de consentement sur l'écran de connexion ; documents consultables même déconnecté
- Aucun **bandeau cookies** : seul le strictement nécessaire est déposé (session, cache hors ligne)

### Onboarding
- **Illustrations SVG** retravaillées (marmite, toque de chef, panier de courses, foyer)
- Barre de progression épurée ; navigation au **clavier** (flèches) sur desktop ; effet au survol du bouton « C'est parti ! »

### Finitions
- **Bascule clair / sombre** enfin fluide et uniforme sur toutes les pages
- Sidebar desktop allégée

## v3.6.1 – Safran · Correctifs

- **PWA hors ligne** : la session est désormais restaurée au démarrage à froid d'une appli installée (persistance d'authentification IndexedDB explicite) ; toute navigation hors ligne sert le shell. Fini le blocage « hors connexion »
- **Onboarding** repensé en **plein écran** (fond coloré par étape, illustration, pastilles, « C'est parti ! »)
- **Carnets (mobile)** : le liseré de surbrillance du carnet sélectionné n'est plus rogné en haut

## v3.6.0 – Safran · Refonte du planning & profil

### Planning intelligent
- **Générateur de semaine** (bouton « Générer ») : filtre le vivier par tes contraintes dures (régime, allergènes, catégories exclues) puis classe les recettes par saison, équilibre, variété, effort étalé, stock et affinité batch. Annulation en un tap
- **Repas composé** : entrée + plat + accompagnement + dessert. Bouton « Compléter » pour ajouter un service, avec **suggestions de saison** par rôle
- **Réutilisation des portions** : une recette cuisinée pour plusieurs couvre plusieurs repas de la semaine (fini les portions perdues)
- **Créneau Petit-déjeuner** ajouté ; « Selon mes préférences » de Découvrir utilise le même filtre que le planning
- **Session batch** : plats à cuisiner et **préparations de base partagées** à préparer d'avance, avec quantités agrégées

### Profil
- Nouvelle page **Profil** (menu avatar) : **nom d'affichage** modifiable, **activité cuisine** en heatmap façon GitHub + statistiques, et **purge des données** (planning, courses, stock ou tout)

### Finitions
- Onglets de la fiche recette en **switch segmenté** glissant (mobile)
- **Notifications** en bas de l'écran sur mobile (snackbar)
- Barre de statut **PWA** alignée sur la couleur du thème
- Accueil : un repas composé s'affiche en **une seule carte**

## v3.5.0 – Safran · Types de recette & carnets intelligents

### Types de recette
- Nouveau champ **Type de recette** (Apéritif, Entrée, Soupe, Salade, Plat, Gratin, Pasta, Pizza, Accompagnement, Dessert, Tarte, Petit-déjeuner, Boisson, Sauce, Boulangerie) : badge sur la fiche, filtre dédié, rempli aussi par l'import IA

### Carnets intelligents
- Les carnets peuvent désormais être des **vues de filtres enregistrées** : on filtre, on enregistre la vue, le carnet se remplit tout seul (les carnets manuels restent possibles)
- Consultation et **modification des filtres** d'un carnet intelligent
- La **gestion des carnets** (créer, modifier, supprimer) passe des réglages à la page **Mes Recettes** (appui long sur un carnet)

### Confort & finitions
- **Fiche recette (mobile)** : onglets Ingrédients/Ustensiles/Étapes en switch segmenté avec indicateur glissant
- **Notifications** : affichées en bas au-dessus de la barre d'onglets sur mobile (snackbar)
- **PWA** : la barre de statut suit la couleur du thème (clair/sombre) au lieu d'un orange fixe
- **Feuille de filtres** : en-tête « Tous les filtres » collant et opaque ; barres de tri alignées entre Mes Recettes et Découvrir
- **Ingrédient du moment** : rotation hebdomadaire corrigée (ne restait plus figé) et conservé pendant une recherche

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
