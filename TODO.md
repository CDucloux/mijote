# TODO Cardamome : ce qu'il reste à mijoter

Ce fichier ne garde que ce qui est **devant nous**. L'historique détaillé de tout
ce qui a été livré vit dans le `CHANGELOG.md` ; inutile de le dupliquer ici. On
coche au fil de l'eau, et on archive plus bas ce qui est fait.

---

## App native (Android / Capacitor)

Depuis que Cardamome tourne aussi en app native, tout un pan « feel natif » et
« capacités système » s'ouvre. C'est la piste prioritaire du moment.

- [ ] **Paiement Google Play Billing.** Le checkout actuel est Stripe (web),
  non conforme pour vendre Cardamome+ **depuis l'app Android** : Google impose le
  Play Billing pour les biens numériques in-app. Prévoir la couche d'achat native
  (plugin de billing), la vérification serveur du reçu (Cloud Function) et la
  réconciliation avec l'abonnement Stripe côté web (une seule source de vérité
  d'accès `isPlus`, quel que soit le canal d'achat).
- [ ] **Import depuis le partage OS.** S'enregistrer comme cible de partage
  Android : depuis un navigateur / une app, « Partager vers Cardamome » ouvre
  directement l'import IA sur l'URL reçue. Le geste le plus naturel pour capturer
  une recette croisée sur le web.
- [ ] **Notifications push locales.** Rappels de planning (« ce soir : blanquette,
  lance le riz à 19h ») et de batch cooking, via les notifications locales
  Capacitor. Opt-in, réglable dans le profil.
- [ ] **Minuteurs natifs dans le cook mode.** Plusieurs minuteurs simultanés
  (une étape = un timer), qui survivent à la mise en arrière-plan et sonnent même
  écran verrouillé. Extension directe du mode pas à pas.
- [ ] **Scan code-barres vers le stock.** Ajouter un produit au frigo en scannant
  son code-barres (plugin caméra / barcode).

## Le cœur « saveurs » (features différentiatrices)

Le vrai fossé concurrentiel : personne ne le fait bien sur le marché FR. Ça se
greffe directement sur `ingredientDB`.

- [ ] **Moteur d'affinités / accords d'ingrédients.** Le « ça va avec quoi » à la
  *Flavour Thesaurus* de Niki Segnit. Ajouter à chaque ingrédient quelques
  `flavorTags` (familles aromatiques : agrumé, torréfié, lacté, anisé, fumé,
  terreux…) et une liste d'affinités. En édition, l'app suggère « cardamome +
  orange + chocolat marchent ensemble », ou propose l'ingrédient qui ponte deux
  saveurs qui jurent. Sucré comme salé.
- [ ] **Roue d'équilibre des saveurs + « qu'est-ce qui manque ? ».** Pour chaque
  recette, une roue sur 7 axes (sucré / salé / acide / amer / umami / gras /
  piquant). Une partie se dérive déjà du Ciqual (sucre, sel), le reste via tags
  d'ingrédients. Et surtout le troubleshooter façon *Salt Fat Acid Heat* : « plat
  plat -> ajoute de l'acide ou de l'umami », « trop écœurant -> manque
  d'acidité ou d'amertume (zeste, café, fleur de sel) ». L'outil qu'on aurait
  voulu avoir le couteau à la main.
- [ ] **Accords mets-vins (et sans-alcool).** Suggérer par recette un accord vin
  (et une alternative sans alcool : kombucha, jus, infusion) à partir de la
  cuisine, des saveurs dominantes et de la saison. Se branche naturellement sur
  le moteur d'affinités ci-dessus.

## Précision & reproductibilité

- [ ] **Mode ratios / baker's %.** En pâtisserie on pense en pourcentages
  (hydratation, ratio sucre/farine), pas en grammes absolus. Afficher la recette
  en % de la farine et gérer la mise à l'échelle **non-linéaire** : doubler une
  pâte ne double ni le sel d'une fermentation, ni le temps de cuisson, ni la
  taille du moule. Un bandeau « 4 -> 12 parts : attention à la levure et au
  temps » évite des ratés que la mise à l'échelle linéaire actuelle laisse passer.
- [ ] **Conversions exactes + calculatrices d'atelier.** Poids / volume / pièce
  (le champ `gramsPerPiece` fait déjà la moitié du boulot) plus densités par
  ingrédient (1 cup de farine ne pèse pas 1 cup de miel). Et un set de
  calculatrices réutilisées sans arrêt : % de sel d'une saumure, lacto-
  fermentation (2 à 3 % du poids des légumes), ratio sucre/eau d'un sirop, stades
  du caramel par température. Des « mini-recettes » exactes, faciles à poser sur
  la lib métier.

## Exécution sous pression

- [ ] **Timeline « mise en place » multi-recettes.** Un repas à plusieurs
  composants (sauce + plat + dessert) = on jongle. En ajoutant durée et
  dépendances aux étapes, l'app fusionne les étapes sur une frise unique et fait
  le back-timing depuis l'heure de service : « service à 20h -> pâte à 17h30,
  bouillon à 18h ». Extension naturelle du cook mode.

## Import IA & bases de données

- [ ] **Paramètres de fonctionnement des ustensiles.** Enrichir la base ustensiles
  (aujourd'hui `{ id, name, image }`) de réglages structurés : modes et
  températures de four, réglages robot / thermomix (vitesse, sens, durée),
  puissance en watts, capacité… Puis exploiter ces paramètres dans les Cloud
  Functions d'import (`functions/src/imports`) pour un **import IA complet** : les
  étapes citant un ustensile récupèrent ses réglages types, et le schéma de sortie
  les porte.
- [ ] **Élargir la couverture des aliases de techniques** (conjugaisons), avec un
  éventuel stemming léger, pour que le survol/tap dans le cook mode reconnaisse
  plus de gestes.
- [ ] **Enrichir le glossaire des techniques et les préparations de base** depuis
  le *Guide Culinaire* complet (Escoffier).

## Communauté & partage

La base communautaire (recettes publiques, découverte, clone attribué, signalement
et modération) est **livrée**. Restent des extensions :

- [ ] **Partage du planning repas.** D'abord le partage direct dans Cardamome
  (comme les listes / le foyer), puis éventuellement un export `.ics` pour le
  glisser dans un agenda.
- [ ] **Aller plus loin sur la communauté de mijoteurs** (profils publics, suivi
  de créateurs, collections partagées…), à cadrer.
- [ ] **Re-liaison des `dbId` au clone** quand l'auteur d'une recette publique a
  utilisé des ingrédients privés (rapprochement par `nameMatcher`).

## Idées à explorer (pas encore tranchées)

- [ ] **Mode « fainéant »** dans le générateur de planning : ne proposer que des
  recettes rapides / peu d'étapes.
- [ ] **Filtre saisonnier explicite** dans le générateur (été / hiver / …) en plus
  de la pondération de saison déjà en place.
- [ ] **Génération de recette de zéro via API** (Claude / ChatGPT, clé
  utilisateur), distincte de l'import : « fais-moi une recette avec ce que j'ai
  dans le frigo ».
- [ ] **Note sur le traitement des données** : compléter la page légale d'un
  passage clair et honnête sur les données collectées et leur usage.

---

## Déjà livré (résumé)

Détail complet dans `CHANGELOG.md`. Grandes lignes expédiées :

- **Socle** : auth Google + Firebase (Firestore / Functions), PWA installable et
  allégée, app native Android (Capacitor), CI/CD GitHub Actions + tests Vitest sur
  les libs critiques.
- **Recettes** : cook mode pas à pas, recherche par ingrédient, quantités / unités
  inférées, fiche ingrédient cliquable, validation de schéma JSON, import IA
  (URL / photo), export JSON + PDF soigné, historique d'itérations.
- **Bases de connaissance** : couche YAML versionnée (`data/*.yaml`) comme source
  de vérité (ingrédients / ustensiles / techniques), glossaire des techniques
  relié au cook mode, préparations de base publiques (`mijote-official`).
- **Planning & courses** : générateur automatique de planning (avec undo), mode
  frigo relié aux courses, listes de courses (coller, réordonner, catégories,
  « acheté »), partage de listes et foyer (jusqu'à 3 personnes).
- **Communauté** : recettes publiques (public / privé), moteur de découverte
  (créateur / cuisine / saison / Nutri-Score / préférences), clone hybride
  attribué et anti-doublon, signalement + modération.
- **Nutrition & santé** : Nutri-Score, score de santé pondéré, section apports
  détaillés.
- **UI / UX** : architecture par routes, écrans de chargement soignés, animations
  d'entrée, feuilles glissables, pull-to-refresh, thème clair / sombre, feel natif
  (pas de sélection de texte en app), onde tactile (ripple) généralisée, retour
  natif Android câblé sur la navigation interne, page « À propos » / légale.
