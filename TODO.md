


# Listes des fontionnalités à mijoter

- [x] Sur mobile, bug de la swipeable sheet Nouvel ingrédient qui n'est pas scrollable à partir des valeurs nutrtionnelles précises
- [x] Sur mobile, dans la swipeablesheet "Ajouter une recette" -> ne pas ouvrir le clavier initialement (car prend trop de view)
  - [x] Dans cette swipeablesheet, il faut aussi retirer le healthring et le remplacer par le nutriscore plus clean et remplacer le séparateur "." par "|"

- [x] Attention avec les notify de bien gérer les icones en double

- [x] README plus moderne à construire

- [x] App & légal
  - [x] Page À propos — licence, crédits, copyright

- [x] Système saisonnier

- [ ] Lien du mode courses avec le mode frigo (autres, condiments et épices, etc n'a rien à faire dans le frigo par exemple)

- [ ] Partage du planning repas en .ics ? c possible ? mais d'abord mise en place du partage directement dans Mijoté

- [ ] Blabla sur le traitement des données ?

## Features différentiatrices

### Le cœur "saveurs"

1. Moteur d'affinités / accords d'ingrédients. Le "ça va avec quoi" à la Flavour Thesaurus de Niki Segnit. Tu ajoutes à chaque ingrédient de la base quelques flavorTags (familles aromatiques : agrumé, torréfié, lacté, anisé, fumé, terreux…) et une liste d'affinités. En éditant une recette, l'app suggère "le cardamome + l'orange + le chocolat marchent ensemble", ou propose un ingrédient qui ponte deux saveurs qui jurent. C'est la feature pour les cuisiniers de saveurs complexes, sucré comme salé, et elle se greffe directement sur ton ingredientDB. Personne ne le fait bien sur le marché FR.

2. Tableau d'équilibre des saveurs + "qu'est-ce qui manque ?". Pour chaque recette, une roue sur 7 axes — sucré / salé / acide / amer / umami / gras / piquant. Une partie se dérive déjà de ce que tu as (sucre et sel via Ciqual), le reste via tags d'ingrédients. Et surtout le troubleshooter type Salt Fat Acid Heat : "ton plat est plat → ajoute de l'acide (citron, vinaigre) ou de l'umami (parmesan, sauce soja)". Pour le sucré : "trop écœurant → manque d'acidité ou d'amertume (zeste, café, sel de fleur)". C'est l'outil qu'on aurait voulu avoir le couteau à la main.

### Précision & reproductibilité

4. Mode ratios / baker's %. En pâtisserie surtout, on pense en pourcentages (hydratation, ratio sucre/farine), pas en grammes absolus. Affiche la recette en % de la farine, et gère la mise à l'échelle non-linéaire : doubler une pâte ne double pas le sel d'une fermentation, ni le temps de cuisson, ni la taille du moule. Un simple bandeau "tu passes de 4 à 12 parts → attention à la levure et au temps" évite des ratés que ta mise à l'échelle actuelle (linéaire) laisse passer.

6. Journal d'itérations. Les vrais cuisiniers retravaillent une recette : "v3 — -10 g de sucre, +zeste de citron vert, cuit 4 min de moins → meilleur". Versionner une recette avec notes de dégustation et note de résultat. Tes recettes sont déjà des docs Firestore diffés un par un — tu as quasiment l'infra pour un historique. C'est énorme pour la reproductibilité, le point faible de tous les carnets papier.

8. Conversions exactes + calculatrices d'atelier. Poids ↔ volume ↔ pièce (ton champ gramsPerPiece fait déjà la moitié du boulot), plus densités par ingrédient (1 cup de farine ≠ 1 cup de miel). Et un petit set de calculatrices que ce public réutilise sans arrêt : % de sel pour une saumure, fermentation lacto (2–3 % du poids des légumes), ratio sucre/eau d'un sirop, stades du caramel par température. Ce sont des "mini-recettes" exactes, très demandées, faciles à coder sur ta lib métier.

préparations de base et en composants

Franchement, c'est la meilleure idée que tu aies lancée jusqu'ici. Et pas seulement parce que c'est pratique : c'est le concept qui unifie tout le reste. Les cuisiniers sérieux pensent déjà comme ça — en préparations de base et en composants. C'est littéralement la logique des sauces mères de la cuisine française (Escoffier), et de la mise en place pro. Tu ne crées pas une feature gadget, tu modélises la façon dont ces gens-là raisonnent vraiment.
Ce qui la rend forte, c'est l'effet de levier. Aujourd'hui, si quelqu'un a sa béchamel parfaite, il la recopie dans dix gratins, et le jour où il l'améliore, il doit corriger dix recettes. Avec un composant lié, il maintient une source de vérité et toutes les recettes en héritent. C'est exactement le bénéfice du journal d'itérations qu'on évoquait, mais factorisé : tu retravailles ton caramel beurre salé une fois, et tes 6 desserts qui l'appellent en profitent.
L'insight architectural à ne pas rater : une mini-recette n'est pas un type d'objet à part. C'est une recette normale qui peut être référencée comme un ingrédient. Si tu pars là-dessus, tout devient cohérent avec ton modèle existant :

une ligne d'ingrédient pointe soit vers un dbId de ta base, soit vers un recipeId (le composant) ;
ta computeNutritionDetail calcule déjà le per100 et le perServing d'une recette → un composant expose donc sa nutrition "pour 100 g de prépa finie", et se comporte alors comme un ingrédient virtuel dans la recette parente. Ton moteur Nutri-Score remonte tout seul, sans nouvelle logique ;
pour les courses, ta buildShoppingItems doit juste "exploser" le composant en ses ingrédients bruts, mis à l'échelle. La béchamel disparaît de la liste, le lait/beurre/farine apparaissent (et se cumulent si deux recettes en utilisent).

Des exemples au-delà des tiens, pour montrer l'étendue :
Salé — sauce tomate base, fond/bouillon, roux, velouté, hollandaise, beurre blanc, mayonnaise, vinaigrette mère, pesto, bolognaise, oignons confits, ail confit, demi-glace, pâte brisée/feuilletée, marinade, pâte de curry, et même les mélanges secs (dukkah, gomasio, épices à tajine).
Sucré — crème pâtissière, crème anglaise, ganache, praliné, pâte sucrée/sablée, frangipane, lemon curd, sirop de base, compotée, meringue, pâte à choux, glaçage miroir.
Tu remarqueras que beaucoup sont des briques de briques : une frangipane = crème d'amande + crème pâtissière. Donc ton système doit gérer la composition récursive, ce qui amène aux trois pièges à traiter dès la conception :

Le rendement (yield). Un composant "fait 400 g de béchamel", la recette parente en utilise 150 g. Il faut un champ rendement sur le composant et une conversion à l'appel. Sans ça, la nutrition et les courses sont fausses. C'est la partie la moins triviale.
Les références circulaires. A appelle B qui appelle A → boucle infinie au calcul. Une simple détection de cycle à l'enregistrement suffit, mais il faut y penser dès le départ.
L'éclatement des courses. Décider du comportement : on achète les ingrédients bruts du composant (par défaut) ou on coche "je l'ai déjà fait / je l'achète tout prêt". Les pros voudront souvent dire "mon fond de veau, je l'ai déjà au congélo" → un toggle par composant dans la liste.

Côté UX, le seul vrai arbitrage : est-ce que les composants vivent dans la même bibliothèque que les recettes (avec un filtre "composant") ou dans un onglet dédié ? Mon avis : même bibliothèque, juste un flag isComponent, parce qu'une sauce est une recette qu'on peut aussi cuisiner seule — et ça t'évite de dupliquer toute l'UI d'édition.
Le seul point d'attention business : ça augmente la richesse mais aussi la courbe d'apprentissage. Garde l'entrée simple — un cuisinier débutant doit pouvoir ignorer totalement la feature, un cuisinier avancé doit pouvoir la découvrir naturellement (genre "transformer cette recette en composant réutilisable" depuis une recette existante).
Bref : oui, à fond, et je la mettrais même avant certaines features de la famille A, parce qu'elle change la structure de données de manière fondatrice — autant la poser tôt.
Tu veux que je te fasse la spec produit + le modèle de données (champ ingrédient ref: {type: "recipe", id, yieldUsed}, champ yield sur la recette, détection de cycle, règle d'éclatement courses, propagation nutrition) ? C'est le genre de feature où 80 % de la valeur se joue dans la justesse du modèle de départ.

### Exécution sous pression — quand on cuisine gros

7. Timeline "mise en place" multi-recettes. Quand on fait un repas à plusieurs composants (une sauce + un plat + un dessert), on jongle. Si tu ajoutes une durée et des dépendances aux étapes, l'app fusionne les étapes de plusieurs recettes sur une seule frise et fait le back-timing depuis l'heure de service : "service à 20h → lance la pâte à 17h30, le bouillon à 18h". Très pratique, et c'est une extension naturelle de ton cook mode.


## 🔜 Backlog — v2.0.0

- [x] Refactoring des composants / modularisartion

## 🔜 Backlog — v1.0.7

- [x] Qualité & contenu
  - [x] Score de santé plus élaboré (pondération, Nutri-Score)
  - [x] Export PDF revu et amélioré ?

- [x] Section détaillée sur les apports nutritionnels
- [x] Disposer d'une page "Ingrédient"
  - [x] Animation mise en place
  - [x] Pouvoir dans les recettes cliquer sur un ingrédient (dans la partie "Ingrédient") => emmène vers la page de l'ingrédient

- [x] Rework du Frontend menu recette sur mobile
- [x] Fixes de bugs d'UI
- [x] Validation de schéma JSON

- [x] (En mode master uniquement) Pouvoir télécharger la liste de tous les ingrédients implémentés pour feed à Claude précisément (en tant que table dans un fichier markdown) ? (Nom + Aliases + dbid + catégorie pour ingrédients)

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
- [x] Attention pour le schéma JSON, si je veux en faire générer il va d'abord falloir l'envoyer + l'expliciter vraiment en détail (sur les parties raw ? etc etc).

- [ ] Partage du planning repas en .ics ? c possible ? mais d'abord mise en place du partage directement dans Mijoté

- [ ] Mode Frigo + Etageres

- [ ] Communauté de mijoteurs !

- [ ] Proposition automatique de plan sur une semaine (Ajouter dans le mode planning ça)
  - [ ] Mode fainéant (recettes rapides)
  - [ ] Filtre saisonnier (été / hiver / …)

  - [ ] Génération de recette via API Claude / ChatGPT (clé API utilisateur)
