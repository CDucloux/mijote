# Changelog – Cardamome

## v4.0.0 – Cardamome · Nouvelle identité

### Identité
- **Mijoté devient Cardamome** : après avoir observé la concurrence, l'app change de nom pour quelque chose de plus rare et de plus net en bouche. Toute la marque suit, du wordmark aux mentions légales.
- **Nouveau logo, la gousse** : le monogramme dégradé laisse place à une gousse de cardamome nervurée (fuseau symétrique, bec, trois nervures longitudinales), en aplat, sans dégradé ni brillance plastique. Favicon et icônes (PWA, Apple, maskable) régénérés, et la gousse s'affiche désormais à côté du mot dans la barre latérale.

### Interface
- **Nouvelle palette « gousse »** : l'orange cède la place au vert de la gousse comme couleur d'accent (un vert profond qui porte le texte blanc des boutons, plus vif sur le thème sombre), réchauffé d'un ambre de graine pour les touches gourmandes. Fonds et neutres légèrement verdis.
- **Thème sombre moins délavé** : accent ravivé, surfaces et bordures plus franches pour que les cartes se détachent du fond, texte secondaire plus lisible. La profondeur vient du contraste, pas d'un glow.
- **Accent unifié** : les dizaines de touches d'accent posées en dur (fonds actifs de la navigation, halos des boutons, pills, bordures) passent par un token unique et suivent enfin la couleur de la marque, sans résidu orange.

## v3.20.3 – Safran · Livres empilés

### Interface
- **Croquis de bibliothèque redessiné** : l'étagère de tranches verticales (qui se lisait mal) laisse place à une pile de trois livres posés à plat les uns sur les autres, un peu décalés façon dessin à la main, chacun avec son dos rond et sa tranche de pages, le signet accent pendant du volume du dessus. Bien plus reconnaissable comme « des livres » sur l'état vide des recettes.

## v3.20.2 – Safran · Ta bibliothèque

### Interface
- **Bibliothèque vide redessinée** : l'écran « Bienvenue dans ta bibliothèque » troque la cocotte contre un vrai croquis de bibliothèque à l'encre (une rangée de livres de cuisine aux hauteurs inégales, un volume qui s'appuie de travers, un signet accent qui dépasse du plus grand), bien plus juste pour une collection de recettes.
- **Cocotte de l'accueil agrandie** : sur la page de connexion, le croquis de cocotte était trop discret, il gagne en présence.
- **Écran de chargement au trait** : l'emoji fondue laisse place au croquis de cocotte à l'encre, posé au centre de l'anneau de progression.
- **Halos flous retirés** : les taches floutées violet/bleu en fond de la connexion et du chargement disparaissent ; la profondeur vient désormais de la typo, du contraste et du trait, pas d'un glow décoratif.

## v3.20.1 – Safran · Croquis en fondu

### Interface
- **Apparition des croquis en fondu doux** : les états vides ne se dessinent plus « du bas vers le haut » (un balayage qui se lisait mal). Le corps de chaque scène arrive maintenant en fondu, et l'entrée reste soignée grâce au « pop » de sa touche chaude qui vient se poser à la fin.
- **Vapeur de la cocotte raccourcie** : toujours détachée du couvercle (blanc d'air sous les volutes), mais nettement plus basse pour ne plus venir toucher le trait autour, notamment l'anneau du loader de l'écran d'import.

## v3.20.0 – Safran · Tout au pinceau

### Interface
- **Tous les croquis d'états vides redessinés au pinceau** : cocotte, panier, assiette, loupe, bocal et liste passent du contour d'épaisseur constante à un vrai trait à l'encre (formes pleines à épaisseur variable, lavis pour le volume, ondulation plus ample façon dessin à la main). Chaque scène se révèle par un balayage à l'apparition, puis sa touche chaude (le seul accent) vient se poser.
- **Détails plus justes** : la cocotte fume désormais une vraie vapeur qui monte et se dissipe (au lieu d'un va-et-vient), avec un blanc d'air sous les volutes ; l'assiette accueille un œuf au plat (le jaune fait l'accent) encadré d'une fourchette et d'un couteau ; la loupe a un manche à la bonne échelle. Le tout respecte la réduction des animations.

## v3.19.6 – Safran · La cocotte accueille

### Interface
- **Hero de connexion revu** : la page d'accueil affiche la cocotte à l'encre (avec sa vapeur qui monte) plutôt que la toque, plus fidèle à l'esprit Mijoté. Le doux flottement du logo est conservé.

## v3.19.5 – Safran · Bienvenue, chef

### Interface
- **Page de connexion redessinée** : l'emoji fondue laisse place à un croquis à l'encre fait main, une toque de chef avec bandeau accent, plus chaleureux et fidèle à l'identité de Mijoté. Le doux flottement du logo est conservé.

## v3.19.4 – Safran · La cocotte prend vie

### Interface
- **Cocotte redessinée** : le croquis de marmite gagne un couvercle à bouton et deux anses, plus soigné et plus fidèle à « ça mijote ». On le retrouve à l'accueil de la bibliothèque, sur « Tout est acheté ! » et sur l'écran d'attente d'import.
- **Vapeur qui monte** : les volutes de la cocotte s'animent désormais en boucle (une montée et un souffle doux, décalés entre les deux) une fois le trait dessiné, coupées si tu réduis les animations.
- **Écran d'attente d'import plus généreux** : l'anneau de progression et la cocotte au centre sont nettement agrandis pour mieux remplir la carte.
- **Croquis « rien à racheter » élargi** : la petite liste cochée était trop étroite, elle respire mieux.

## v3.19.3 – Safran · Dessiné à la main

### Interface
- **Nouvelle recette recentrée** : l'en-tête de la feuille « Nouvelle recette » troque l'étoile (qui suggérait à tort une fonction IA) contre une icône livre, plus fidèle au sujet, une recette.
- **Écran d'attente d'import redessiné** : pendant l'extraction IA, l'emoji marmite (posé un peu de travers) laisse place à un croquis de cocotte « à l'encre » avec ses volutes de vapeur, et l'anneau de progression ondule et « bout » légèrement comme un trait tracé à la main. La barre de progression reste honnête et l'effet se coupe si tu réduis les animations.
- **États vides variés plutôt que la même loupe partout** : deux nouveaux croquis faits main. Chercher un ingrédient introuvable montre désormais un bocal de placard vide avec un « ? » ; « Rien à racheter » affiche une petite liste toute cochée (« tout est là ») au lieu d'un triangle d'alerte qui semblait signaler un problème.

## v3.19.2 – Safran · Recherches à vide soignées

### Interface
- **États vides de recherche harmonisés** : quand une recherche ne trouve rien, l'écran affiche partout le même croquis animé « à l'encre » (la loupe qui se dessine), avec une vraie invitation à agir. Fini le texte brut posé au milieu de la page.
  - **Mon Stock** : chercher un ingrédient inexistant montre désormais le croquis animé, comme les autres écrans, au lieu d'une simple pastille d'icône.
  - **Découvrir (communauté)** : une recherche publique sans résultat propose de créer la recette ou d'élargir les filtres, avec le même soin visuel que la recherche privée.
- **Carnets escamotés quand rien ne ressort** : dans Mes Recettes, la rangée des carnets se retire dès qu'une recherche ou des filtres ne renvoient aucune recette. L'état vide occupe alors toute la place au lieu d'être coincé sous une bande de carnets.

## v3.19.1 – Safran · Finitions

### Interface
- **Fine ligne grise sous la barre de statut supprimée** : en PWA installée, fermer une fenêtre (feuille du bas, boîte de dialogue) ne laisse plus de trait grisâtre coincé entre la barre système et le corps de l'app. La barre retrouve un aplat net dès la fermeture.
- **Carrousel « À la une » qui s'arrête juste** : dans Découvrir, le défilement horizontal ne file plus longtemps dans le vide après la dernière carte. La longueur du carrousel colle enfin au nombre de recettes affichées.
- **Plus d'écran blanc en quittant une recette publique** : revenir depuis une fiche de recette de la communauté ne provoque plus de flash blanc le temps du retour.

## v3.19.0 – Safran · La barre système se fond dans le décor

### Interface
- **Barre de statut voilée pendant les modales** : en PWA installée, quand une fenêtre (feuille du bas, boîte de dialogue) s'ouvre et grise l'écran, le haut de l'écran s'assombrit désormais du même voile au lieu de rester clair. La barre système suit l'ouverture et la fermeture de toutes les modales de l'app.
- **Barre de statut accordée à l'accueil** : sur l'écran de connexion, la barre système se teinte vers l'orange chaud pour prolonger la lueur du dégradé jusqu'en haut de l'écran, au lieu de trancher sur un aplat neutre (la teinte s'adapte au thème clair/sombre et se retire en quittant l'écran).

## v3.18.0 – Safran · Le planning tient bon

### Planning
- **« Planning » tout court** : l'écran ne s'appelle plus « Planning Repas », le titre est allégé.
- **Annuler une génération qui reste disponible** : le bouton d'annulation ne disparaît plus dès qu'on change de semaine ou d'onglet. Il reste proposé sur la semaine générée, y compris après un rechargement complet de la page, jusqu'à ce qu'on annule ou relance une génération. Sur les autres semaines, la génération reste possible comme avant.
- **Bouton « Annuler » soigné** : pilule blanche épurée avec une vraie icône de retour (flèche undo) au lieu du chevron.

### Courses
- **Bouton « Supprimer la liste » épuré** : liseré retiré, survol qui avive le rouge sur ordinateur, onde tactile au tap sur mobile.
- **États vides plus cohérents** : le titre « Liste vide » adopte la même typographie que « Tout est acheté ! », et la copie « Tous les ingrédients de cette liste ont été cochés » est plus directe.

### Interface
- **Survol des boutons du profil** : sur ordinateur, tous les boutons de la page Profil réagissent désormais au passage de la souris (feedback qui s'adapte au thème clair/sombre).
- **Retour tactile sur l'onglet actif** : changer d'onglet déclenche une onde dans la pastille orange de la barre de navigation (mobile).
- **Menu du compte animé à la fermeture** : le menu de l'avatar se replie avec une animation de sortie au lieu de disparaître d'un coup ; chaque action joue la fermeture avant de naviguer.
- **Survol du bouton « Dissoudre le foyer »** : le rouge se densifie au passage de la souris.
- **Spinner de déconnexion visible** : la roue de chargement de la modale de déconnexion tourne assez longtemps pour être perceptible, au lieu d'un éclair fugace.
- **Grain de papier retiré** : le léger grain de fond introduit en 3.17 est retiré (rendu peu convaincant), retour à un fond à plat.

### Performances
- **Accueil qui s'affiche plus vite** : au rechargement, le squelette de chargement se lève plus tôt. Les lectures Firestore (données perso et foyer) sont menées en parallèle et la base de référence est chargée en arrière-plan, sans retarder l'affichage du tableau de bord.

## v3.17.0 – Safran · L'encre s'anime

### Interface
- **Croquis d'états vides animés** : les dessins au trait se tracent désormais en cascade à l'apparition, comme esquissés à la main (animation coupée si le système demande moins d'animations).
- **Croquis étendus aux autres écrans vides** : « aucune recette trouvée », les listes de sélection vides du planning, « rien à acheter » et « liste vide » adoptent la même famille de croquis (loupe, panier), pour un langage visuel cohérent partout.
- **Grain de papier** : un très léger grain façon papier habille le fond de page, en clair comme en sombre (volontairement discret en thème sombre), pour renforcer le côté fait main sans alourdir.

## v3.16.0 – Safran · Le trait fait main

### Interface
- **Écrans vides dessinés à l'encre** : les grands états vides (bibliothèque de recettes, aucune liste de courses, tout est acheté) affichent désormais un croquis au trait (cocotte, panier, assiette) plutôt qu'une icône dans une boîte. Tous partagent la même irrégularité « posée au pinceau » pour un rendu fait main cohérent, s'adaptent au thème clair/sombre, et gardent une touche chaude en terracotta. Au passage, l'emoji de l'accueil bibliothèque laisse place au dessin.

## v3.15.1 – Safran · Retouches d'écran

### Recettes
- **Cartes sans image plus soignées** : tant qu'une photo de recette n'est pas chargée, la carte affiche l'état vide travaillé (initiale sur halo coloré) au lieu d'un carré blanc, puis l'image apparaît en fondu une fois prête.
- **Feuille « Publier cette recette » modernisée** : en-tête à puce accent et titre soigné, et avertissement sur le droit d'auteur restructuré (icône bouclier, titre puis corps) au lieu d'un pavé bordé.

## v3.15.0 – Safran · Bases détectées, écrans soignés

### Recettes
- **Préparations de base reconnues à l'import** : l'import IA (URL et photos) sait maintenant repérer une préparation de base réutilisable (caramel, pâte, fond, sauce mère, appareil…) et la classe comme telle, avec sa famille (fond, sauce, appareil, liaison, pâte, sirop, marinade) et un rendement estimé à corriger, au lieu d'une recette sans catégorie. Un plat qui *contient* une base reste un plat.
- **Feuille de conversion en cuillères repensée** : en-tête avec la quantité source en pilule, équivalents cuillère à soupe / café regroupés dans un bloc épuré à filets fins, et le badge d'accès posé en bas à droite de la vignette de l'ingrédient (mobile et bureau).

### Courses
- **Feuille d'ajout modernisée** : en-tête à puce accent et titre soigné, bascule Article / Coller une liste à pastille glissante, et bouton d'ajout à la nouvelle icône « plus » cerclée.

### Foyer
- **Nom personnalisé** : ta fiche membre affiche le nom que tu as choisi dans l'app, plus le nom technique du compte.
- **Panneau clarifié** : bandeau d'information resserré, et bouton « Dissoudre / Quitter le foyer » franchement rouge (action destructive lisible).

## v3.14.0 – Safran · Cap sur le mobile

### Recettes
- **Badge de conversion sur la vignette** : la conversion d'une quantité en cuillères se déclenche via un petit badge « flèches » posé en bas de l'image de l'ingrédient, désormais visible aussi bien sur mobile que sur le bureau (elle manquait sur la liste bureau). Le badge n'apparaît que pour les ingrédients réellement convertibles.

### Sous le capot
- **Préparation des apps mobiles** : la PWA peut désormais être empaquetée en application native via Capacitor (Android d'abord, iOS à terme), sans changer le site web. La **connexion Google** bascule automatiquement sur le SDK natif dans l'app installée (le popup web ne fonctionne pas dans une WebView), le web restant inchangé. Guide complet dans `MOBILE.md`.

## v3.13.0 – Safran · Sans balance

### Recettes
- **Conversion en cuillères d'un tap** : toucher la quantité d'un ingrédient (quand ça a du sens) ouvre son équivalent en cuillères à soupe et à café (« 100 g ≈ 6 ¾ c. à soupe »), pratique pour qui n'a pas de balance. Le volume (ml, cl, l) est toujours converti ; la masse (g, kg) seulement quand la densité de l'ingrédient est connue, pour ne jamais afficher une valeur trompeuse. Les équivalents suivent la mise à l'échelle des portions.

### Ustensiles
- **Type d'appareil contextuel** : dans l'éditeur d'ustensile, le choix du type d'appareil (four, blender…) n'apparaît que pour la famille « Appareils » ; changer de famille l'efface, plus de champ superflu.

## v3.12.0 – Safran · Ustensiles rangés, appareils réglés

### Ustensiles
- **Catégorisation** : chaque ustensile appartient désormais à une famille (Cuisson, Appareils, Découpe, Mesure, Préparation, Pâtisserie, Filtrage, Divers). La console d'administration et le sélecteur d'ustensiles d'une étape les regroupent par famille, bien plus lisible à mesure que la base grandit.
- **Appareils avec réglages** : un ustensile peut être un **appareil** (four, air fryer, blender, robot pâtissier, batteur, mixeur plongeant, cuiseur à riz). Chaque appareil expose ses propres réglages, saisis **au niveau de l'étape** (température, mode de cuisson, préchauffage, vitesse, programme, durée…). Une même recette peut ainsi régler le four à deux températures selon l'étape.
- Le réglage est **résumé sur la pastille** de l'ustensile dans la fiche recette et le mode cuisine (« Préchauffage · 180 °C · Chaleur tournante »).

### Éditeur de recette
- **Champs Ingrédients et Infos sans bordure** : à l'image des étapes, les champs du formulaire adoptent une surface douce sans liseré dur, pour un rendu plus épuré.

## v3.11.3 – Safran · Éditeur pleine largeur

### Éditeur de recette
- **Entête et champs étendus au cadre** (bureau) : l'entête et tous les champs du formulaire vont désormais jusqu'au bord de la colonne, sans bande morte à gauche et à droite, le tout centré dans la zone de contenu

## v3.11.2 – Safran · Finitions tactiles

### Interface & tactile
- **Onde tactile** étendue aux cartes de recette (bibliothèque et Découvrir) et aux cartes d'ustensile, ainsi qu'à la carte « l'ingrédient du moment » (mobile)
- **Notifications** : animation de sortie vers le bas sur mobile (standard snackbar)
- **Rotation verrouillée en portrait** (PWA installée, et invite à revenir en portrait dans le navigateur)
- Plus de **surbrillance de survol « collée »** sur les cartes de l'accueil au tap/appui long (mobile)
- Boutons des fenêtres et dialogues **sans liseré** (rendu plus épuré)
- Cercle de « l'ingrédient du moment » : un seul anneau net (fini le « double cercle »)

### Recettes & communauté
- **Nom d'auteur** des recettes publiées : le nom choisi dans l'app (préférences) prime sur le nom Google (effectif à la re-publication)
- « Publier » depuis « l'ingrédient du moment » ouvre l'éditeur, pré-rempli avec l'ingrédient

### Corrections
- **Découvrir** : les carrousels ne défilent plus « dans le vide » (cartes qui gonflaient à la largeur de leur image)
- **Fractions** (½, ⅓, ¾…) réservées aux unités discrètes (pièce, gousse, cuillère…) : les mesures métriques (g, kg, ml…) repassent au décimal

## v3.11.1 – Safran · Éditeur au cordeau

### Éditeur de recette
- **Glisser-déposer réparé sur mobile** : réordonner un ingrédient ou une étape au doigt fonctionne de nouveau (la ligne suit le doigt, la destination s'illumine), avec défilement automatique quand on atteint le bord de l'écran
- **Onglets sans clignotement** : passer d'Infos à Étapes n'allume plus au vol les onglets traversés (l'effet s'aggravait avec la distance)
- **Tout est aligné** : barre d'action, onglets et contenu partagent la même colonne, l'onglet Ustensiles compris

## v3.11.0 – Safran · Mise en place cochable

### Mode pas à pas
- **Mise en place cochable** : les ingrédients et ustensiles de l'écran d'aperçu se cochent au fur et à mesure qu'on les rassemble, avec un compteur de progression
- **Regroupement par catégorie (optionnel)** : les ingrédients peuvent s'afficher par rayon (Légumes, Produits laitiers…) plutôt qu'en liste plate, préférence mémorisée d'une recette à l'autre

## v3.10.49 – Safran · Toilettage éditorial

### Sous le capot
- **Suppression de tous les tirets cadratins** du dépôt (code, commentaires, docs, prompts IA, README, CHANGELOG) : nouvelle règle CLAUDE.md qui les bannit définitivement, remplacés par des virgules, deux-points ou parenthèses selon le contexte
- **README remis à jour** (badge de version, nombre de tests, accès Mijoté+ à l'import IA, variables Stripe) : la checklist de MEP impose désormais explicitement sa mise à jour à chaque version
- Tests unitaires ajoutés pour `stripAiDashes` (jusqu'ici non testée)

## v3.10.48 – Safran · Onde tactile

### Interface & tactile
- **Onde tactile** (ripple) aussi sur l'avatar
- Menus (feuilles carnet / liste / recette) : le fond reste teinté tant que le doigt est posé, avec un relâchement en douceur, fini le retour instantané
- Onde ripple plus posée (moins « sèche »)

## v3.10.47 – Safran · Hors-ligne & fluidité

### Synchronisation & hors-ligne
- **Fini la bascule vers le solo hors-ligne** : on reste sur le foyer (plus de « 10 recettes / 0 carnet » quand le réseau saute), et le skeleton ne tourne plus indéfiniment
- Chargement : squelette / spinner pendant l'hydratation (accueil, recettes, planning, courses, stock) au lieu d'un flash « vide » trompeur

### Performance
- Bascule vers **« Recettes » nettement plus rapide** : saison, vegan et Nutri-Score ne sont plus recalculés à chaque passage sur l'onglet

### Recettes & communauté
- **Nutri-Score des recettes publiques** (Découvrir) recalculé en direct, fini les lettres erronées sur les cartes
- Import IA : dans une recette à sous-sections, une étape ne récupère plus par erreur un ingrédient homonyme d'une autre section
- Fiche : les feuilles « Publier », « Ajouter à mes recettes » et « Signaler » ne se rouvrent plus après validation

### Interface & tactile
- Cartes de recettes (privées) : même effet de pression franc que sur Découvrir
- **Onde tactile (ripple)** façon Android sur les boutons ronds de la fiche recette et les rangées d'accueil
- Console admin : bonne icône (rouleau) sur la tuile Ustensiles

## v3.10.46 – Safran · Comptes & finitions

### Synchronisation
- **Changement de compte** : plus de « fuite » des données de l'autre compte (recettes, carnets…) le temps du chargement, l'écran repart à vide au switch
- **Base commune** protégée : un échec de lecture (session dégradée) n'écrase plus le cache local par du vide

### Interface
- Fiche : bloc d'ingrédients hors-section désormais titré **« Autres »** : la frontière avec une sous-préparation est enfin nette (fiche + PDF)
- Menu avatar : « Console admin » en gris foncé, badge violet identique à l'en-tête
- Menus mobiles (recette, carnet, liste) : **onde tactile** au toucher, comme les ingrédients
- « À propos » : changelog limité aux **5 dernières versions**

## v3.10.45 – Safran · Sections libres & finitions

### Recettes
- **Éditeur repensé** : ingrédients et étapes s'affichent dans l'ordre réel, réordonnancement **libre** (une ligne rejoint la section du bloc où on la place), en-têtes de section en ligne, la pastille de section disparaît
- **Étapes (fiche desktop)** : nouvelle **timeline** (nœuds numérotés reliés), numérotation **continue** et ordre réel alignés sur le mode pas à pas ; blocs de section clairement délimités
- **PDF** : sous-préparations encadrées, numérotation continue
- **Import IA** : les sections (« Pour la pâte »…) sont désormais reconnues et restituées

### Interface
- Fiche ingrédient : badge « Lecture seule » retiré
- Accueil : fin du clignotement de l'ingrédient du moment au chargement
- Courses : poubelle ronde au survol, « Valider l'achat » en pill, correctif du modal qui réapparaissait
- Console admin : onglets inactifs en blanc, nouvelle icône **ustensiles** (rouleau)
- Badge Admin : icône agrandie
- Polices chargées plus tôt (fiabilité mobile)

## v3.10.44 – Safran · Partage

### Partage
- Aperçu de lien (réseaux, messageries) : **logo affiché** et textes au tutoiement (les balises pointaient sur une image inexistante)

## v3.10.43 – Safran · Bouton section

### Recettes
- Éditeur : bouton **« Nouvelle section »** redessiné (icône dédiée, style distinct des ajouts d'ingrédient/étape) et saisie du nom modernisée

## v3.10.42 – Safran · Sections glissées

### Recettes
- Éditeur (mobile) : on peut désormais **glisser un ingrédient ou une étape d'une section à une autre** (ou vers/depuis le hors-section), pas seulement au sein d'une même section

## v3.10.41 – Safran · Édition fluide

### Recettes
- Éditeur : flèches monter/descendre redessinées (rondes, fond au survol) pour les ingrédients et les étapes
- Ligne d'ingrédient : **Retour arrière** sur une ligne vide la supprime et revient à la précédente (miroir d'Entrée qui en crée une)

## v3.10.40 – Safran · Import & finitions

### Recettes
- **Import IA** : reconnaît désormais les recettes structurées en sous-préparations (« Pour la pâte », « Pour la crème »…) et les restitue en **sections** : sans jamais en inventer sur une recette à liste simple
- Éditeur : boutons « dissoudre » et corbeille arrondis, au fond apparaissant seulement au survol

## v3.10.39 – Safran · Éditeur d'étape

### Recettes
- **Refonte moderne de l'éditeur d'étape** : carte plus aérée, badge en dégradé, zone d'instructions adoucie, et surtout les **ingrédients/ustensiles liés en puces avec vignette** (image) et état sélectionné plein accent
- Une **préparation de base** ne peut s'assigner qu'à une section (jamais hors section, ni si la section contient déjà des ingrédients)

## v3.10.38 – Safran · Sections (finitions)

### Recettes
- Éditeur : le choix **Ingrédient / Base** est toujours proposé dans chaque section (assigner une préparation de base à la section), et « **Nouvelle section** » passe avant les ingrédients/étapes hors section
- Onglet Étapes aligné sur les Ingrédients (sections d'abord, hors-section en bas)
- Nouvelle **icône** plus parlante pour les sections

## v3.10.37 – Safran · Sections & bases

### Recettes
- Éditeur : les **sections** (sous-préparations) passent en premier, les ingrédients **hors section** sont regroupés en bas
- Chaque section peut désormais porter ses propres ingrédients **ou** une **préparation de base** : le sélecteur Ingrédient/Base est remplacé par deux actions claires dans chaque zone
- Affichage cohérent partout (fiche, PDF, mode pas à pas) : les sous-préparations d'abord, l'assemblage ensuite

## v3.10.36 – Safran · Sections (éditeur)

### Recettes
- L'éditeur d'ingrédients et d'étapes s'organise désormais **par sections** : on crée une section (« La pâte », « La crème »…) puis on y ajoute directement ses ingrédients et ses étapes. En-tête renommable, dissolution, et réordonnancement à l'intérieur de chaque section

## v3.10.35 – Safran · Sections de recette

### Recettes
- **Groupements d'ingrédients et d'étapes** : organise une recette en sous-préparations nommées (« Pour la pâte », « Pour la crème »…). Chaque ingrédient et chaque étape peut être rattaché à une section, affichée avec son en-tête dans la fiche, le PDF et le mode pas à pas
- Filtres : nouvelle section **« Type de préparation de base »** (fond, sauce, appareil, liaison, pâte, sirop, marinade)

### Interface
- Recettes publiques : boutons du haut réordonnés (impression → signalement → suppression) et **icône drapeau** pour le signalement
- Déconnexion : petit **spinner** pendant la révocation de la session
- Le panneau « Tous les filtres » joue son **animation de sortie** sur toutes les fermetures (croix, Appliquer…)

## v3.10.34 – Safran · Comptes & finitions

### Connexion
- La déconnexion affiche un **spinner** pendant la révocation de la session
- Google propose désormais le **sélecteur de compte** à chaque connexion, plus besoin de purger les cookies pour changer de compte

### Onboarding
- Dernière slide : « La cuisine à plusieurs » et formulation au tutoiement (« À toi de jouer ! »)

## v3.10.33 – Safran · Préparations de base

### Éditeur de recette
- Pour une **préparation de base**, l'éditeur propose désormais les grandes familles culinaires (fond, sauce, appareil, liaison, pâte, sirop, marinade) au lieu des rôles-repas (apéritif, plat, dessert…) qui n'avaient aucun sens dans ce contexte
- **« Sauce »** retiré des types de recette classiques, réservé aux préparations de base

### Interface
- Badge **« ADMIN »** en majuscules
- Page de connexion : petit **spinner de chargement** pendant la connexion Google

## v3.10.32 – Safran · Traçabilité Nutri-Score

### Nutrition
- Nouvel onglet **« Calcul »** dans l'analyse nutritionnelle : le détail du Nutri-Score (points négatifs vs positifs, valeurs pour 100 g, et l'équation qui aboutit à la lettre), réservé aux abonnés **Mijoté+**

## v3.10.31 – Safran · Cohérence admin

### Console admin
- **Bandeau « MODE ADMIN »** et **icône de la console** passés au violet, en cohérence avec le badge Admin
- Fiche ingrédient : le Nutri-Score (auto-calculé) est masqué en mode édition, plus aéré sur mobile

## v3.10.30 – Safran · Statut ingrédient

### Console admin
- **Pastille de statut** sur l'image de l'ingrédient (coche verte si validé, crayon ambre si en cours), dans la liste ET sur la fiche
- En édition, le statut se change en **cliquant la pastille sur l'image** (avec confirmation), le sélecteur du haut disparaît

### Interface
- Badges **Admin / Mijoté+** de hauteur égale ; badge Admin en police de corps
- En-tête de la fiche ingrédient : bord des boutons au survol + flèche de retour animée

## v3.10.29 – Safran · Badge Admin & finitions

### Admin
- Nouveau **badge Admin** (violet) affiché dans le Profil, avant le badge Mijoté+, c'est lui qui indique que les quotas (imports, limite de recettes) ne s'appliquent pas ; l'ancien encadré « 👑 » des imports est remplacé

### Interface
- **Bouton retour** de la page Profil et de la page Mijoté+ : flèche animée au survol (comme les écrans d'import)
- Titre d'onglet **« Abonnement »** sur la page Mijoté+ (au lieu de « Accueil »)

### Sous le capot
- Début d'une **couche de primitives d'UI** (Row/Col/Card…) pour dégraisser et fiabiliser les styles, refactor interne, sans changement visuel

## v3.10.28 – Safran · Repli fiable

### Corrections
- **Repli de l'en-tête recette** (mobile) fiabilisé : il fonctionne désormais à l'identique quel que soit l'onglet (Ingrédients / Ustensiles / Étapes), même après en avoir changé
- La **bande compacte** en haut ne laisse plus transparaître le contenu qui défile dessous (fond opaque une fois replié)

## v3.10.27 – Safran · Feel natif & finitions

### Feel natif
- **Onde tactile** sur les lignes d'ingrédient (mobile) : au tap, la couleur se répand depuis le point de contact, façon app native
- **Repli du hero** garanti même sur les recettes à peu de contenu (fini l'en-tête bloqué à mi-course)

### Interface
- **Statut d'ingrédient** : « en stock » (et « bientôt vide ») affiché en brun avec une icône garde-manger, distinct du vert « de saison »
- Bouton **« Mode pas à pas »** (desktop) en pill

### Sous le capot
- Version de Node épinglée (`engines`) à la racine pour aligner local / Vercel / CI

## v3.10.26 – Safran · Sheets & Nutri-Score

### Nutrition
- **Nutri-Score cohérent partout** : la carte de « Mes recettes » et le tri « Nutri-Score » utilisent désormais le score recalculé en direct, comme la fiche, fini les écarts entre carte et détail

### Interface
- **Feuilles repensées** dans un style unifié et moderne : « Ajouter au planning » (sélecteur de repas unique en contrôle segmenté, sans étalement), « Ajouter aux courses » (en-tête, sélection en pills, rangées teintées) et menu d'un carnet (liste homogène, position en pill)
- **Menu d'une recette** : actions rapides en rangées, comme le reste du menu
- **Carnets** : animation de survol plus fluide, ombres retirées, création au rendu plus sleek

## v3.10.25 – Safran · Poids à la pièce

### Nutrition
- **Nutri-Score corrigé sur les recettes « à la pièce »** : un ingrédient en quantité nue (« 2 avocats », « 1 citron vert ») est enfin pesé selon son poids à la pièce, et non plus à 1 g, la masse du plat, la couverture et le Nutri-Score redeviennent justes

## v3.10.24 – Safran · Analyse honnête

### Nutrition
- **Analyse masquée quand les données manquent** : si la plupart des ingrédients n'ont pas encore de fiche nutritionnelle, l'app affiche « Analyse indisponible » au lieu de chiffres trompeurs (fini les « 3 kcal par portion » ou « 15 g de sel pour 100 g »)

## v3.10.23 – Safran · Nutrition juste

### Nutrition
- **Nutri-Score fiable** : la lettre est recalculée en direct (fini les recettes figées à un vieux score) et les **fruits** comptent enfin dans les points positifs, un guacamole n'est plus noté E
- **Apport par portion** corrigé : il ne dépend plus du sélecteur de portions (une assiette reste une assiette)

### Courses
- **Décocher un article acheté** est désormais animé : le barré se retrace et la ligne se rallume avant de remonter

## v3.10.22 – Safran · Batch malin

### Planning
- **Batch cooking plus malin** : la génération privilégie les plats à gros rendement (une cuisson pour plusieurs repas) et les recettes partageant des ingrédients bruts déjà engagés dans la semaine (olives, feta, oignons, sauce tomate…), pour écouler les restes plutôt que les gaspiller

## v3.10.21 – Safran · Édition en place

### Console admin
- **Édition WYSIWYG** de la fiche ingrédient : chaque élément (photo, titre, catégorie, frise de saison, valeurs nutritionnelles, poids, tips) s'édite directement à sa place, l'ancienne feuille de saisie disparaît
- Création d'un ingrédient : ouvre directement sa fiche en édition

## v3.10.20 – Safran · Fiche éditable

### Console admin
- **Édition d'un ingrédient in-place** : la fiche elle-même devient le formulaire (identité, saisonnalité, nutrition, tips), plus élégant et cohérent que l'ancienne feuille

## v3.10.19 – Safran · Carnets & fondations

### Carnets
- **Création/édition de carnet** repensée : aperçu en direct du carnet, sélecteurs de couleur et d'icône modernisés

### Filtres
- Filtres avancés : toutes les catégories **repliées par défaut**

### Sous le capot
- **Observabilité** : fondation de suivi des erreurs (filets globaux, remontée depuis l'app et les fonctions), invisible côté usage, essentielle pour la fiabilité

## v3.10.18 – Safran · Console pilotée

### Console admin
- Nouveau **dashboard** « Vue d'ensemble » : volumétrie des bases, avancement de la validation des ingrédients, et pistes « à compléter » (sans photo / sans nutrition)
- **Statut de rédaction** des ingrédients (validé / en cours), visible dans la liste et filtrable
- Navigation de la console avec icônes

## v3.10.17 – Safran · Fiche ingrédient

### Fiche ingrédient
- **Frise de saison** modernisée (même barre continue que « L'ingrédient du moment »)
- Badge et pastille **« De saison »** alignés sur ceux des cartes recettes
- Bandeau d'actions du haut épuré (boutons ronds, style 2026)
- Titre d'onglet = nom de l'ingrédient consulté

## v3.10.16 – Safran · Fignolage

### Interface
- **États vides des Courses** repensés (centrés, plus accueillants) et empty state « aucune liste » aligné sur le style des recettes
- **Fenêtre de difficulté** d'une recette entièrement modernisée (jauge, récap du calcul)
- **Fenêtre « À propos »** : le changelog passe en bas
- **Avatar** : l'anneau orange indique désormais l'abonnement Mijoté+
- Bouton d'ajout d'ustensile dans la console admin, retouches diverses

## v3.10.15 – Safran · Console admin

### Nouveautés
- **Console admin** dédiée (accès en tête du menu, réservée aux admins) : gestion des bases Ingrédients / Ustensiles / Techniques et **modération** des recettes signalées
- Les **préférences** et l'**export/import** de recettes rejoignent la page **Profil**
- Le **changelog** est désormais dans la fenêtre « À propos »

### Découvrir
- « L'ingrédient du moment » : fond épuré et **nouvelle frise de saison** plus lisible

## v3.10.14 – Safran · Démarrage hors-ligne

### Corrections
- **Lancement hors-ligne** de la PWA : plus de blocage prolongé sur « Connexion en cours… », l'app démarre désormais depuis le cache dès que la session est restaurée, sans attendre le réseau

## v3.10.13 – Safran · Fluidité & finitions

### Performances
- Scroll nettement plus fluide sur les pages chargées (ex. « Mes recettes » à 55 cartes) : la couche GPU n'est plus promue à chaque amorce de défilement

### Feel natif
- Effet d'étirement au défilement rendu plus subtil

### Finitions
- Listes de courses : plus d'espace mort en bas des listes issues de recettes
- Mode pas à pas : titres « Ingrédients »/« Ustensiles » sans compteur à la mise en place
- Slogan de la fenêtre « À propos » aligné sur la page d'accueil (tutoiement)

## v3.10.12 – Safran · Ton & modération

### Ton
- Tutoiement complété : titre d'onglet et écran de fin du mode pas à pas

### Recettes de la communauté
- **Signaler** et **Supprimer (admin)** déplacés en haut à droite de la recette, à côté de l'export PDF

## v3.10.11 – Safran · Étirement & tutoiement

### Feel natif
- **Overscroll vertical** repensé en effet d'**étirement** élastique du contenu (au lieu de le faire monter), piloté au doigt avec retour en ressort

### Ton
- **Page d'accueil** passée au tutoiement pour rester cohérente avec le reste de l'app

## v3.10.10 – Safran · Pas à pas & élastique

### Corrections
- **Mode pas à pas** rétabli sur les recettes de la communauté (le bouton restait sans effet)

### Feel natif
- **Rebond d'inertie** et rubber-band subtil ajoutés à la vue d'une recette et à l'éditeur (Infos, Ingrédients, Ustensiles, Étapes)

## v3.10.9 – Safran · Élastique partout

### Feel natif
- **Rubber-band vertical** rendu bien plus subtil : le contenu monte beaucoup moins haut
- **Overscroll horizontal élastique** ajouté aux carrousels « Découvrir » et « À cuisiner » de l'accueil, ainsi qu'aux onglets de la page Configuration

## v3.10.8 – Safran · Appui natif

### Feel natif
- **Retour tactile** (cartes, boutons, éléments pressables) repensé façon app native : appui vif mais adouci, et relâchement en ressort avec un léger « pop », fini le retour sec
- **Overscroll horizontal élastique** ajouté sur la rangée des carnets dans « Mes Recettes »

## v3.10.7 – Safran · Rebond d'inertie

### Feel natif
- **Rebond par inertie** : un lancer (fling) qui arrive au bas de page par sa seule vitesse déclenche désormais un rebond, proportionnel à l'impact
- Élastique qui remonte moins haut et redescend plus en douceur (retour moins abrupt)

## v3.10.6 – Safran · Rubber-band natif

### Feel natif
- **Rubber-band vertical** refait avec la vraie physique iOS/WebKit : le contenu suit le doigt puis résiste de plus en plus, avec un ressort de retour posé
- Déclenchement plus sensible en bas de page et relâche propre quand on inverse le geste
- Effet câblé sur **Accueil**, **Recettes**, **Planning**, les feuilles **Ajouter une recette** et **Compléter le repas**, **Mon stock** et **Courses**

## v3.10.5 – Safran · Overscroll affiné

### Corrections
- **Overscroll horizontal** : étirement plus doux et borné (5 % max), plus de flicker au relâcher, et fin de l'étirement « sans limite » quand on inverse le geste en cours de route

## v3.10.4 – Safran · Repas & feel natif

### Planning
- **Un créneau = un repas** : les recettes ajoutées se regroupent en un seul repas (rôles affichés), la barre verticale n'apparaît que pour un 2ᵉ plat, y compris rétroactivement sur les repas existants
- Feuilles **Ajouter une recette** et **Compléter le repas** : barre de recherche standard (loupe du clavier mobile, effacement)

### Feel natif
- Overscroll horizontal **« stretch »** (scaleX élastique) sur les rangées de pills, effet rubber-band à la iOS

### PWA
- Nouvelle tentative de coloration de la zone système du bas (couleur de page)

## v3.10.3 – Safran · Planning & imports peaufinés

### Corrections
- **PWA** : le bas de l'écran reprend la couleur de l'appli (fin de la bande aux couleurs système)
- Écran d'import : plus de tremblement à l'entrée sur mobile

### Planning
- Une recette ajoutée compte comme un **repas standard** (barre verticale + rôle du plat) au lieu du libellé « Midi »/« Soir »
- L'**apéritif** compte comme une **entrée**
- Sheet « Ajouter » : créneau en **sélection simple**, bascule fluide, `+` qui se transforme en ✓ vert avant la fermeture
- Bouton d'ajout du jour restylé (puce accent)

### Imports IA
- Jauge de quota repensée (barre = ce qu'il **reste**), écran épuré (retour unique, mention prestataire retirée)
- Ouverture d'un import : la page **glisse depuis la droite** ; flèches animées au survol

### Bibliothèque & listes
- Résultats de recherche en **cascade** (fondu par carte)
- États vides repensés (Stock, Courses)

## v3.10.2 – Safran · Finitions & robustesse

### Corrections
- **Barre d'onglets (mobile)** : elle ne disparaît plus en tirant / overscrollant la page (correction pérenne du dimensionnement du shell)

### Finitions UI
- **Squelettes de chargement** : les titres « Carnets » et « Recettes » ont aussi leur trame pendant le chargement
- **États vides repensés** (icône, titre, action) et enfin centrés :
  - **Stock** : recherche sans résultat → message clair + « Effacer la recherche »
  - **Courses** : une liste-recette entièrement cochée affiche « Tout est acheté ! » + suppression de la liste

### Interne
- **Cloud Functions** migrées en **TypeScript** (typage strict, TSDoc), organisées par domaine (imports IA / abonnements / quotas)

## v3.10.1 – Safran · Quotas & modération

### Imports IA
- **Quotas d'import** pour les abonnés Mijoté+ : lien **5/jour · 60/mois**, photo **3/jour · 30/mois**, décomptés côté serveur (l'admin reste illimité)
- **Compteurs visibles** dans les écrans d'import : reliquat du jour et du mois, bouton bloqué et message clair quand la limite est atteinte
- **Hors ligne** : l'import IA est bloqué avec un message explicite (la connexion est nécessaire à l'extraction)

### Modération
- L'**admin** peut retirer n'importe quelle recette **publique** (sans toucher à la copie privée de l'auteur)
- Tout utilisateur peut **signaler** une recette publique

### Détails
- **Squelettes de chargement** sur les carnets et la grille de recettes (privées et publiques)

## v3.10.0 – Safran · Mijoté+ & Batch cooking

### Mijoté+ (abonnement)
- **Paiement en ligne** entièrement fonctionnel via une intégration **Stripe maison** (Cloud Functions), sans dépendance à l'extension Firebase : souscription, portail de gestion et résiliation
- **Sécurité** : webhook à signature vérifiée, validation du tarif, garde anti-double-abonnement, accès aux imports IA ouvert aux abonnés (vérifié côté serveur)
- Page **/plus** : bandeau de confirmation quand tu es abonné, comparatif plus lisible (croix rouges), badge Mijoté+ restylé

### Batch cooking
- La **session batch** devient une **page dédiée** (mise en place, cuissons à mutualiser, bases, plats) qui reflète **en direct** le planning de la semaine

### Rework UI/UX
- **Éditeur de recette** repensé, **profil** et **fiche ingrédient** modernisés
- Feuilles **Ajouter / Compléter un repas**, **Nouvelle liste**, sélecteur **Nouvelle recette** et **bulle des techniques** retravaillés
- Détails : carnets sur une seule ligne, fondu de la grille de recettes

## v3.9.25 – Safran · Éditeur repensé

### Création / édition
- **Éditeur de recette repensé** : barre d'action épurée, onglets segmentés à icônes, section « Infos » réorganisée, zones d'ajout modernisées et rendu centré sur desktop

## v3.9.24 – Safran · Bulle technique enrichie

### Mode cuisine
- **Bulle de définition d'une technique** nettement enrichie : pastille emoji et couleur selon la catégorie (découpe, cuisson, liaison, préparation, dressage), niveau de difficulté et source mieux mise en valeur

## v3.9.23 – Safran · Techniques & correctif

### Mode cuisine
- **Bulle de définition d'une technique** retravaillée : plus jamais coupée sur les bords (mobile), apparition en fondu, style plus soigné

### Correctif
- La feuille **« Nouvelle liste »** ne se rouvre plus après la création d'une liste

## v3.9.22 – Safran · Fiche ingrédient & courses

### Ingrédients
- **Fiche aliment retravaillée** : système de cartes claires, saisonnalité et nutrition plus lisibles, survols soignés sur desktop

### Courses
- **Feuille « Nouvelle liste » modernisée** : en-tête à pastille, suggestions de noms, réglages plus clairs

## v3.9.21 – Safran · Nouvelle recette

### Création
- **Sélecteur « Nouvelle recette » modernisé** : en-tête à pastille d'icône, cartes plus claires, chevron circulaire et survol soigné sur desktop

## v3.9.20 – Safran · Profil & finitions

### Profil
- **Page profil retravaillée** : carte d'identité unifiée, plan mis en avant (barre de quota / carte Mijoté+), tuiles d'activité avec icônes et responsive, zone de danger encadrée

### Mes Recettes
- **Carnets** sur une seule ligne avec défilement horizontal sur desktop (comme sur mobile)
- **Fondu doux** de la grille à chaque changement de résultats (recherche, tri, carnet)

## v3.9.19 – Safran · Ajouter une recette

### Planning
- **« Ajouter une recette »** retravaillée dans le même esprit que « Compléter le repas » : en-tête daté, créneaux en contrôle segmenté, recherche épurée et cartes enrichies (cuisine, temps, ingrédients, Nutri-Score)

## v3.9.18 – Safran · Compléter le repas

### Planning
- **« Compléter le repas »** entièrement retravaillée : en-tête avec vignette du plat, sélecteur de rôle segmenté, cartes de suggestion enrichies (cuisine, temps, ingrédients, Nutri-Score) et bouton d'ajout plus lisible

## v3.9.17 – Safran · Retouches mode cuisine

### Mode pas à pas
- « Mise en place » : formulation plus claire
- Pastille « Précédent » : suppression de l'ombre parasite
- Numéro d'étape : correction de l'affichage (plus de bascule noir → blanc)

## v3.9.16 – Safran · Finitions mode cuisine & import

### Mode pas à pas
- Boutons **Précédent / Suivant / Terminé** en pastilles ; bouton fermer avec survol sur desktop
- Icône **étoile** pour « Noter une itération » (au lieu de l'étincelle)
- Rendu net du numéro d'étape

### Import IA
- **Anneau de progression** enfin fluide : remplissage régulier calé sur la durée d'extraction (animation CSS, indépendante des rendus)

### Rédaction
- Suppression des **tirets cadratins** (marqueur IA) dans les textes d'étape, à l'affichage comme à l'extraction

## v3.9.15 – Safran · Mode cuisine & finitions

### Mode pas à pas
- **Mise en place** : une première page liste tous les ingrédients et ustensiles, on peut cuisiner du début à la fin sans revenir à la fiche
- **Chrono** : le temps écoulé depuis le lancement de la recette s'affiche en continu dans l'en-tête

### Profil
- L'activité cuisine compte désormais les **plats réellement cuisinés** (menés au bout du mode pas à pas), et non plus les repas planifiés

### Corrections
- **Ingrédient reconnu après coup** : sa valeur nutritionnelle compte dans le Nutri-Score et son détail est accessible depuis la fiche, sans ré-enregistrer
- **Import IA** : l'anneau de progression se remplit correctement, calé sur la durée d'extraction
- **Mes Recettes** : animation d'entrée sur toutes les cartes

## v3.9.14 – Safran · Import & fluidité

### Import IA
- **Barre de progression** pendant l'extraction : un anneau qui se remplit, calé sur la durée estimée (lien / photo(s)), au lieu du simple cercle qui tourne
- **Marmite figée** au centre de l'anneau (fin de l'animation de pulsation)
- **Brouillon préservé** : l'éditeur d'une nouvelle recette a désormais une URL dédiée (`/recipes/new`) et un cache, le contenu extrait n'est plus perdu par un rafraîchissement ou un retour arrière accidentel

### Performance
- **Page « Mes Recettes »** nettement plus fluide au scroll sur mobile : suppression du flou d'arrière-plan des badges (Vegan, De saison, Base) et rendu différé des cartes hors écran

## v3.9.13 – Safran · Mijoté+ (abonnement & finitions)

### Mijoté+
- **Abonnement en ligne** : le paiement est branché (Stripe), l'accès Mijoté+ s'active automatiquement, avec gestion de l'abonnement
- **Limite du plan gratuit** : au-delà de 50 recettes, la création renvoie vers l'offre Mijoté+
- **Ton plan dans le Profil** : plan actuel, décompte de recettes et lien vers l'offre

### Finitions
- **Fin du mode cuisine** : boutons en pastilles et retour à la recette immédiat
- **Desktop** : survol des cartes de recette plus fluide

## v3.9.12 – Safran · Mijoté+ (tarifs & foyer)

### Mijoté+
- **Foyer partagé** rejoint les fonctionnalités Mijoté+
- **Tarifs affichés** : bascule mensuel (3,99 €/mois) / annuel (29,99 €/an, -37 %)
- Comparatif : colonnes « Plan gratuit » et « Plan Mijoté+ » distinctes

## v3.9.11 – Safran · Mijoté+

### Nouveauté : l'offre Mijoté+
- **Page Mijoté+** avec un tableau comparatif Gratuit vs Mijoté+
- **Fonctionnalités Mijoté+** : import de recettes par IA (lien & photo), journal d'itérations, génération de planning et batch cooking. En plan gratuit, ces options mènent à la page de présentation
- **Recettes** : jusqu'à 50 en gratuit, illimitées en Mijoté+

### Interface
- **Boutons des fenêtres en pastilles** partout, pour un rendu plus net
- **Pages d'import affinées** : une seule icône par page, emplacement d'ajout de photo centré et soigné

## v3.9.10 – Safran · Import photo peaufiné

### Import de recettes
- **Transition fluide vers l'import** : ouvrir « Importer depuis un lien » ou « une photo » enchaîne désormais proprement (la page glisse à l'entrée), sans le petit temps mort d'avant
- **Bouton « Retour » clarifié** : en blanc avec une icône retour
- **Ajout de photo repensé** : à vide, un emplacement centré et soigné (pastille d'icône, cadre pointillé) ; dès la première photo, la seconde se place à droite

## v3.9.9 – Safran · Transitions & import soigné

### Navigation
- **Transitions de page** : les écrans (Profil, Configuration, Informations légales et les onglets) apparaissent désormais avec une animation d'entrée douce, au lieu de surgir d'un coup

### Import de recettes
- **Pages d'import redessinées** : boutons en pastilles, champ et cartes d'aide en blanc, et cartes « partage » / « confidentialité » avec pastille d'icône colorée, plus lisibles et plus nettes

## v3.9.8 – Safran · Gestes & finitions

### Planning
- **Accès à la session batch repensé** : l'ancien bouton d'en-tête (qui repoussait le titre sur deux lignes) laisse place à une bannière contextuelle claire en tête de semaine, affichée seulement quand il y a des plats à cuisiner

### Import de recettes
- **Quantités d'épices en grammes** : l'import IA n'emploie plus l'unité imprécise « pincée », les épices, le sel et le poivre (même « au goût ») sont estimés en grammes *(effectif après mise à jour du serveur)*

### Gestes & mobile
- **Fermeture au doigt fluide** : glisser une fenêtre vers le bas la fait maintenant filer proprement jusqu'en bas, sans le petit sursaut où elle remontait avant de redescendre
- **Effet élastique généralisé** : le rebond discret en bas de liste (déjà présent sur les recettes) s'applique désormais au Planning, aux Courses, au Stock et à Mes recettes, et il est plus subtil sur la fiche recette

## v3.9.7 – Safran · Documentation & barre du bas

### Documentation
- **Documentation technique publiée** : la bibliothèque métier (`src/lib`, 40 modules / 187 fonctions) est désormais générée en site statique via TypeDoc et publiée sur GitHub Pages à chaque mise à jour

### Interface mobile & PWA
- **Barre de navigation système au thème** : en PWA installée, la barre du bas (gestes Android / indicateur iOS) prend la couleur de l'appli au lieu de la couleur système, la barre d'onglets peint désormais la zone système sous elle

## v3.9.6 – Safran · Import & finitions mobiles

### Import de recettes
- **Pages d'import repensées** : l'import par lien et par photo passent en pages plein écran dédiées (adresses propres `/recipes/import-from-url` et `/recipes/import-from-picture`), navigables et partageables
- **Coller le lien copié** : si un lien de recette est dans le presse-papiers, un bouton le propose en un tap
- **Partage vers Mijoté** : partage une page depuis ton navigateur (feuille de partage du système) et la recette arrive directement dans l'import, le lien pré-rempli, il ne reste qu'à confirmer *(PWA installée)*

### Interface mobile & PWA
- **Onglet actif en surbrillance** : la barre du bas met en évidence l'onglet sélectionné par une pastille derrière l'icône
- **Barres système au thème de l'appli** : en PWA installée, les barres du haut et du bas suivent le thème clair/sombre de Mijoté (et non celui du système), sans clignotement au lancement

## v3.9.5 – Safran · Détails soignés

### Connexion
- **Écran « Connexion en cours… » toujours visible** : après une connexion, l'écran de chargement s'affiche désormais au moins une seconde, fini le flash imperceptible quand la session est déjà en cache. Sans effet quand on rouvre l'app déjà connecté (aucun délai inutile)

### Fenêtres modales
- **Animation de sortie sur « Annuler »** : les boutons « Annuler » des fenêtres jouent maintenant la même animation de fermeture que le glissé ou le clic sur le fond, au lieu de disparaître d'un coup (planning, courses, carnets, profil, fiche recette, configuration…)
- **Déconnexion harmonisée** : la fenêtre de confirmation de déconnexion adopte le style commun (animation d'entrée et de sortie, focus sur « Annuler », fermeture par Échap)

## v3.9.4 – Safran · Connexion isolée

### Corrections
- **Récap de session batch honnête** : le récap comptait des items là où il fallait compter des créneaux, il affiche désormais le vrai nombre de **repas couverts** (créneaux date × midi/soir distincts) et de **cuissons** (seuls les plats qui cuisent réellement)
- **Glissement du toggle de thème** : sur la page d'accueil, la bascule clair / sombre passe désormais **progressivement** d'un état à l'autre au lieu de sauter

### Sous le capot
- **Module d'authentification dédié** : toute la logique de connexion Google (allowlist, repli sur redirection, déconnexion) est sortie d'`App.jsx` vers `lib/firebase/auth.ts` (découplé de React) et un hook `useAuthUser`, `App.jsx` ne manipule plus le SDK Firebase Auth directement
- **Route `/login` dédiée** : l'écran de connexion a désormais sa propre route publique, séparée des routes protégées ; à la déconnexion, la page précédente n'est plus laissée montée derrière, et à la reconnexion on revient à la dernière page consultée
- Aucun changement fonctionnel visible : réorganisation interne pour la maintenabilité

## v3.9.3 – Safran · Correctifs

- **Bascule clair / sombre réparée** : le changement de thème ne fonctionnait plus (ni sur la page d'accueil, ni dans l'app), corrigé
- **Session batch ré-ouvrable** : un bouton dédié dans l'en-tête du planning permet de rouvrir la session batch à tout moment (plus seulement juste après une génération)
- **Mise en place ciblée** : la préparation mutualisée ne liste plus que les **légumes et herbes aromatiques** (les seuls produits frais dont la découpe se mutualise vraiment)

## v3.9.2 – Safran · Batch cooking mutualisé

### Planning
- **Choix des créneaux à générer** (Midi / Soir) dans l'auto-génération de la semaine, décoche « Midi » quand tu manges à la cantine, l'appli ne remplit alors que le soir. Choix mémorisé d'une semaine à l'autre

### Batch cooking repensé
- **Mise en place mutualisée** : tous les ingrédients de la semaine, toutes recettes confondues, **regroupés et sommés par ingrédient** (« prépare tous les oignons d'un coup »), classés par catégorie, avec le **geste de préparation**, l'**estimation en pièces** (« 500 g d'oignons · ~5 ») et une **checklist cochable**
- **Cuissons à mutualiser** : les plats qui partagent le même appareil (four, plaques…) sont regroupés, on n'allume le four qu'une fois
- **Récap de session** : nombre d'ingrédients à préparer, de cuissons et de repas couverts

## v3.9.1 – Safran · TypeScript de bout en bout

### Sous le capot
- **Fin de la migration TypeScript** : tout `src/lib` (37 modules) et tous les hooks (21) sont désormais typés, y compris `firebase`/`firestore` et la couche de synchronisation
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
- **Hauteur des pastilles uniformisée** : fini les pastilles de tailles inégales

### Import photo
- **Extraction sur Sonnet 5** en **haute résolution** : lecture bien plus fidèle des pages de livre (moins d'oublis, moins d'erreurs de lecture)
- **Prompt dédié aux photos** (mise en page en colonnes, deux pages, aplatissement des groupes d'ingrédients)
- **Détection de la photo du plat** parmi les pages fournies → utilisée automatiquement en **image de couverture**

### Thème & affichage
- Bascule **clair / sombre fluide** sur les pages denses (accueil, recettes, stock)
- **Éditeur** : les unités des ingrédients liés ne collent plus à la quantité et le **pluriel** est appliqué correctement

### Sous le capot
- **Migration TypeScript** de `src/lib` quasi terminée (planificateur, courses batch, foyer, import/export, PDF, recettes publiques, stockage…), il ne reste que `firebase` et `firestore`

## v3.8.6 – Safran · Imports fiables & finitions

### Import IA (lien & photo)
- **Import photo réparé** : les photos sont redimensionnées avant l'envoi, fini l'erreur « deadline-exceeded » sur les grandes images
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

- **Mes recettes** : tri par défaut sur les **plus récentes** (au lieu de A → Z), plus simple pour retrouver ce qu'on vient d'ajouter. Le dernier ajout apparaît bien en tête, même parmi les recettes du même jour. Les tris A → Z et Santé restent disponibles.

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
- **Import depuis un lien** : colle l'URL d'une recette, l'IA (Claude Haiku) l'extrait et la met en forme (ingrédients, étapes à l'infinitif, liaisons ingrédients/ustensiles), à relire avant d'enregistrer. Réservé au créateur, garde vérifiée **côté serveur**
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
- **« L'ingrédient du moment »** en tête de Découvrir : un fruit/légume de saison (rotation hebdomadaire), sa frise de saison, une accroche et les recettes publiques qui l'utilisent, ou une invitation à publier
- **Filtres unifiés avec Mes Recettes** : mêmes options exactement, via la même feuille de filtres

### Filtres avancés (Mes Recettes & Découvrir)
- **Feuille de filtres** repensée façon « Mob » : sections repliables, tri intégré
- Filtrer par **type**, **temps total**, **régime & saison**, **cuisine**, **Nutri-Score**, **difficulté**, **mode de cuisson** (four, air fryer, plaques… déduit des ustensiles, « mixte » si plusieurs) et **ingrédients** (multi-sélection avec vignettes)
- Bouton **Filtres** avec surbrillance élégante au survol sur desktop

### Badges
- Nouveau badge **Vegan** (ni viande, ni poisson, ni produits laitiers) ; le badge **De saison** est relooké (icône soleil / ambre)

### Foyer
- **Départ / dissolution** d'un foyer : les recettes créées dans le foyer ne disparaissent plus (fusion additive dans l'espace perso) et l'état vécu est conservé, plus de vieille liste de courses qui « ressuscite »
- **Retrait du partage de listes de courses** individuel : le mode foyer couvre déjà ce besoin, de façon plus cohérente

### PWA
- **Icônes d'application nettes** (fini le SVG pixellisé à l'ajout à l'écran d'accueil) : icônes PNG dédiées (dont une version *maskable*) + manifeste d'application
- Zoom et sélection de texte désactivés en mode **standalone** uniquement (feel natif sans gêner le navigateur)

### Sous le capot
- **Coûts Firestore** : l'annuaire des utilisateurs (avatars) n'est plus chargé pour tout le monde à chaque session, chargement **à la demande** (foyer, invitations), les utilisateurs solo ne le lisent jamais

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
