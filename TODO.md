
# Listes des fontionnalités à mijoter

## 🔜 Backlog — v1.0.7

- [x] Qualité & contenu
  - [x] Score de santé plus élaboré (pondération, Nutri-Score)
  - [x] Export PDF revu et amélioré ?

- [x] Section détaillée sur les apports nutri
- [x] Disposer d'une page "Ingrédient"
  - [x] Animation mise en place
  - [ ] Pouvoir dans les recettes cliquer sur un ingrédient (dans la partie "Ingrédient") => emmène vers la page de l'ingrédient 
- [x] Fixes de bugs d'UI

- [ ] Notifications ? à mette en place (Comment gérer pour le PWA ?)

- [x] (En mode master uniquement) Pouvoir télécharger la liste de tous les ingrédients implémentés pour feed à Claude précisément (en tant que table dans un fichier markdown) ? (Nom + Aliases + dbid + catégorie pour ingrédients)

- [ ] Validation de schéma JSON
- [ ] Attention pour le schéma JSON, si je veux en faire générer il va d'abord falloir l'envoyer + l'expliciter vraiment en détail (sur les parties raw ? etc etc).

## 🔜 Backlog — v1.0.6

- [x] Architecture avec routeurs vers pages /config, /recipes, etc etc
  - [x] Faire pareil pour les recettes individuelles - id des recettes

- [x] Ecran de chargement + stylé, avec un spinner notamment
- [x] Ecran fixe au niveau des recettees + gestion du bug UI sur le scroll down
- [x] Retirer le mode planif "Mois"
- [x] Animations quand on rentre sur toutes les pages de Mijoté
- [x] Approche + moderne sur l'ajout des ustensiles (icones, etc !) dans le formulaire crea et modif recete
- [x] Bandeau "Mode Lecture" ou un truc un peu stylé analogue au bandeau master quand on est en lecture

- [x] Pour tous les popup (Succes; error, etc etc => Avoir une icone) + comportement étrange des popup - ça pop un peu à droite avant d'arriver au milieu ?

## 🔜 Backlog — v1.0.5

- [x] Simplification Courses : ne plus disposer des pills Manuel, A-Z, Catégories => En effet, le tri doit par défaut etre groupé par catégorie et etre alphabétique. La catégorie "Pris" devient "Acheté" et elle est affichée en bas elle par contre - l'icone poubelle doit etre affichée en rouge + remonter "Ajouter un article" en haut de la liste + sur mode desktop, faire en sorte que ça fasse toute la largeur du screen (il faudra un switch à droite pour coller une liste avec tous les éléments plutot que de le faire dans le même widget)

- [x] Limite maximum de caractères pour en moyenne 50 articles à implémenter aussi + limite à 200 caractères côté "Ajouter un article" (si pas déjà fait)

- [x] Disposer d'un badge (couelur orange ? vs couleur verte quand je suis syncrho à firebase) qui dit quand je suis en Mode offline (plutot que juste "Synchronisation...") ?

- [x] Dans la partie config ustensiles, pouvoir afficher 3 ou 4 cards sur la même ligne quand je suis en mode desktop + ustensiles triés par défaut dans l'ordre alphabétique dans le volet "ustensiles" de config.

- [x] Partage de liste de courses (version alpha)

## 🔜 Backlog — v1.0.4

- [x] Mode Courses : 
  - [x] Pouvoir coller une liste de courses séparés par un \n et commençant par des tirets
  - [x] Pouvoir réordonner la liste des ingrédients (par ordre alphabétique) et possibiité d'affichage par groupe de catégories d'articles
  - [x] Une fois cochés, les articles doivent être groupés dans une catégorie en dessous
  - [x] Pouvoir modifier individuellement un ingrédient ou le supprimer de la liste
  - [x] Le passage dans la catégorie "pris" doit etre plus fluide, et pas instant
- [x] Le système de recherche du mode frigo doit etre le même que sur les autres pages

- [x] Corriger le bug d'affichage sur mobile du mode pas à pas + ajouter aussi les ustensiles dans le mode pas à pas
- [x] Charger les images + vite (gestion du cache)

- [x] Au niveau du backggound d'image des ingrédients et ustensiles => il doit etre blanc (qu'on soit en theme light ou dark) - c'est plus facile à gérer car certaines images ont soit pas de bg, soit des bg blancs

- [x] Tab ustensiles + ingrédients avec indicateurs de nombre + scroll à partir du message master DB

## 🔜 Backlog — v1.0.3

- [x] Système de parsing pluriel amélioré
- [x] Nombre d'ingrédients sur la card de recetes dans "Mes Recettes"
- [x] Indicateur du nombre d'ingrédients dispo dans la Master DB
- [x] Pour la génération du pdf, avoir moins de marge sur la gauche et la droite, + avoir l'image principale de la recette
- [x] Pur la génération du pdf, mieux géréer les sauts de page aussi
- [x] Limiter à 24 portions MAX

## 🔜 Backlog — v1.0.2

- [x] Entrée dans le mode "Pas à pas" trop instantannée -> nope.
- [x] Même système de Zoom sur la landing page
- [x] Couleur de sélection d'éléments 
- [x] MAJ du schéma JSON pour refléter les changements qu'il y a eu au niveau des steps (suppression du champ "description" + du sous champ "title" dans steps)
- [x] Suppression du champ "description" quand on génère un ou plusieurs JSON de recettes + du sous champ title dans les steps

- [x] UI Improvements
  - [x] Smartphone : si je tire mon doigt vers le bas, je peux recharger la page
  - [x] Afficher le planning avec une animation un peu comme les recettes
  - [x] Quand on clique sur une collection, petite animation pareil, là c'est trop direct
- [x] Listes non liées aux recettes => pas d'image
- [x] Bouton de déconnexion en rouge
- [x] Aller chercher la version dans le package.json
- [x] Avatars d'images améliorés 


## 🔜 Backlog — v1.0.1


DB: 
- [x] Je ne peux plus modifier la DB ingrédients Master ni les ustensiles.

- [x] UI
  - [x] A la fois un sujet UI et Backend, mais un score de santé ne peut par construction jamais être à 100 (si il est à 100 côté UI c'est moche en plus)
  - [x] Le nom récupéré via Google Auth doit etre affiché en MAJUSCULE
  - [x] Switcher le thème doit être déporté dans la partie profil quand je clique sur l'avatar 
  - [x] Sur desktop comme sur mobile, quand on clique sur une recette pour l'afficher en détail, il faut faire en sorte que l'affichage ne soit pas instantanné (encore une fois, UX)
  - [X] Sur mobile, dans la partie recette - pouvoir avoir la fonctionnalité style "swiper" à droite pour passer de manière fluide entre ingrédidents, ustensiles et étapes (pareil pour le formulaire nouvelle recette ou modifier la recette, + le switch entre info, ingrédients, ustensiles et étapes doit etre + fluide)
  - [x] Quand on est en mode light, corriger le bug UI dans "Mon Frigo" le bouton "Tous" est trop noir
  - [x] Uniformiser la hauteur des titres quand sur mobile + avatar
  - [x] Sur mobile, avoir la possibilité de faire glisser vers le bas certains popups (Ajouter au planning, ajouter aux courses, ajouter au frigo, supprimer la recette, supprimer la liste)

## ✅ Fait — v1.0 Cardamome

- [x] Auth & Sync
  - [x] Authentification Google avec avatar
  - [x] Intégration Firebase Firestore + Auth Google

- [x] Système de Recettes
  - [x] Mode recette pas à pas (cook mode)
  - [x] Recherche par ingrédient
  - [x] Ingrédients : quantités et unités inférées
  - [x] Tags : saisie sans virgule
  - [x] Display du lien source dans la recette

- [x] Import / Export
  - [x] Drag & drop JSON
  - [x] Rework UI import/export (volets dépliables)

- [x] Navigation & UX
  - [x] Landing page avant connexion
  - [x] Planning : corrections des bugs

- [x] Inventaire et Mode Frigo

## 🔭 Horizon — v1.2+

- [ ] Liste partagées => Maximum 3 personnes qui peuvent etre ajoutées et à qui on peut partager

- [ ] Partage du planning repas en .ics ? c possible ? mais d'abord mise en place du partage directement dans Mijoté

- [ ] Refactoring des composants / modularisartion

- [ ] Lien du mode courses avec le mode frigo (autres, condiments et épices, etc n'a rien à faire dans le frigo par exemple)

- [ ] Mode Frigo + Etageres

- [ ] Communauté de mijoteurs !

- [ ] Proposition automatique de plan sur une semaine (Ajouter dans le mode planning ça)
  - [ ] Mode fainéant (recettes rapides)
  - [ ] Filtre saisonnier (été / hiver / …)

  - [ ] Génération de recette via API Claude / ChatGPT (clé API utilisateur)

- [ ] App & légal
  - [ ] Page À propos — licence, crédits, copyright
