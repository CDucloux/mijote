# Cardamome : analyse de positionnement

3 octobre 2026 · Corentin Ducloux

> **Instantané au 3 octobre 2026 (v4.59.13).** Depuis, la v4.59.14 a livré deux recommandations de la section « Les créatrices de niche comme canal » : le suivi des clics sortants (`ref=cardamome` + compteur mensuel par site) et le blocage de la republication des recettes importées. Les constats de cette section sur ces deux points décrivent donc l'état antérieur.

**Verdict.** Cardamome est un produit techniquement au-dessus de la moyenne de sa catégorie, vendu au prix haut de la catégorie (49,99 €/an), dans le segment du marché qui capte le moins de valeur : l'abonnement B2C « organiseur de recettes ». Les pools de revenus importants du secteur sont ailleurs (commission sur paniers de courses, publicité, verrou matériel). Sans canal de distribution, l'ordre de grandeur réaliste est un revenu de dizaines de milliers d'euros par an, pas de millions. Le levier n'est pas d'ajouter des fonctionnalités, mais de choisir un segment à forte disposition à payer et de mesurer.

**Statut des chiffres.** Les faits produit viennent du code (v4.59.13). Les chiffres marché viennent de sources publiques relevées le 3 octobre 2026 (liste en fin de doc). Les coûts IA sont des estimations explicites, à remplacer par les logs réels. Aucune donnée d'usage de Cardamome (utilisateurs, conversion, churn) n'était disponible : c'est la principale limite de cette analyse.

## 1. Le produit, tel qu'il existe

Cardamome couvre la chaîne complète : collecter, planifier, acheter, stocker, cuisiner. C'est un périmètre plus large que la plupart des concurrents, qui en couvrent deux ou trois maillons.

| Maillon | Ce qui existe dans le code | Monétisé (Cardamome+) |
| --- | --- | --- |
| Collecter | Éditeur complet ; import IA depuis URL, photo, texte, PDF (Claude Haiku 4.5 pour le texte, Claude Sonnet 5 pour la vision) avec détection des découpes et des préparations de base | Oui, 100 crédits/mois ; 1 import offert |
| Organiser | Carnets manuels et intelligents, journal d'itérations versionné avec diff, style de cuisine | Recettes illimitées (50 en gratuit) |
| Évaluer | Nutri-Score et score santé calculés depuis la table Ciqual (ANSES), saisonnalité, difficulté | Détail du calcul Nutri-Score |
| Planifier | Semainier, générateur de semaine (saison, stock), session batch, apports du jour, export .ics | Générateur, batch |
| Acheter et stocker | Listes triées par rayon, bases éclatées en ingrédients bruts, stock alimenté par les achats | Non |
| Cuisiner | Mode pas à pas, poste « Découpe » agrégé et mis à l'échelle, minuteurs natifs, glossaire de gestes, réglages d'appareil par étape | Non |
| Partager | Foyer temps réel, journal d'activité, recettes publiques avec aperçu riche | Foyer |

Prix : 4,99 €/mois ou 49,99 €/an TTC, paiement Stripe (un canal Google Play est documenté dans le repo). Distribution : PWA web, Firebase, connexion Google. Le produit est français de bout en bout (données Ciqual, vocabulaire, saisons).

## 2. Taille de marché

Les rapports « recipe apps market » ne sont pas exploitables. Pour la même année 2025, Spherical Insights annonce 6,07 Md USD, un autre éditeur 6,41 Md USD, et Technavio une croissance totale de seulement 516,9 M USD sur 2025-2030. Un écart d'un ordre de grandeur, des méthodologies non publiées, et un périmètre qui mêle portails publicitaires, box repas et appareils connectés. Aucune décision ne devrait s'appuyer dessus.

Une estimation par le bas est plus honnête. Trois points d'observation réels :

- **ReciMe** (organiseur avec import IA, 60 USD/an) : 400 000 utilisateurs et 60 000 USD d'ARR fin 2023. Soit environ 1 000 payants, une conversion utilisateur vers payant d'environ 0,25 %, et 0,15 USD de revenu annuel par utilisateur.
- **Jow** (planning + courses, gratuit pour l'utilisateur) : 1,5 à 2 millions d'utilisateurs mensuels en France, revenu estimé à 10-25 M USD, pris en commission sur les paniers et en publicité retail media (20-30 % du revenu).
- **Cookidoo** (recettes Thermomix) : plus de 6,3 millions d'abonnés à environ 60 €/an, soit un ordre de grandeur de 380 M€/an, mais adossé à un appareil vendu plus de 1 000 €.

Lecture : la disposition à payer existe quand l'abonnement est lié à un appareil ou à une transaction. Pour un organiseur autonome, elle est faible : la conversion observée chez ReciMe est d'un quart de pour cent.

**Scénario Cardamome (France, hypothèses explicites).** Prenons la base Jow (1,5-2 M d'utilisateurs mensuels) comme proxy du public français qui planifie ses repas sur une app. Si Cardamome atteint 1 % de ce public, soit 15 000 à 20 000 utilisateurs actifs, et en convertit 2 à 5 %, cela donne 300 à 1 000 abonnés. À environ 40 € nets par abonné et par an (section 4), le revenu se situe entre 12 000 et 40 000 €/an. Atteindre 1 % du public de Jow sans budget d'acquisition est déjà une hypothèse ambitieuse. Pour dépasser cet ordre de grandeur, il faut un canal de distribution, pas une fonctionnalité de plus.

## 3. Concurrents et pools de revenus

Le secteur se divise en cinq modèles économiques. Cardamome est dans le quatrième, le plus petit en valeur capturée par utilisateur.

| Modèle | Acteurs | Qui paie | Ce que ça implique pour Cardamome |
| --- | --- | --- | --- |
| Commission sur paniers + retail media | [Jow](https://www.mntd.fr/jow-un-nouvel-acteur-du-retail-media-qui-ne-manque-pas-d-appetit-755661/) | Les enseignes (Carrefour, Intermarché, Leclerc, Auchan) | Gratuit pour l'utilisateur : impossible à battre sur le prix pour le public « que mange-t-on ce soir » |
| Audience publicitaire | Marmiton (20 M+ visiteurs/mois revendiqués) | Annonceurs | Capte la recherche de recettes ; Cardamome ne peut pas rivaliser sur le contenu |
| Verrou matériel | [Cookidoo](https://www.drweb.de/cookidone-vorwerk-ki-kochassistent-thermomix/) (Vorwerk), Samsung Food+ | L'utilisateur, via un écosystème | Montre une disposition à payer de 60 €/an, mais tirée par l'appareil |
| Abonnement organiseur | ReciMe, Honeydew, Pestle, Plan to Eat, Mealime, AnyList, Cardamome | L'utilisateur | Conversion faible (ReciMe : environ 0,25 %), concurrence dense, import IA déjà généralisé |
| Achat unique ou gratuit | Paprika, Mela, Crouton ; Mealie et Tandoor (auto-hébergés, environ 7 000 et 5 000 étoiles GitHub) | Personne, ou une fois | Ancre le prix perçu d'un « gestionnaire de recettes » près de zéro récurrent |

Deux signaux de fond. D'abord, les fabricants d'électroménager qui ont acheté des apps de recettes en sont sortis : Whirlpool a fermé [Yummly](https://en.wikipedia.org/wiki/Yummly) en décembre 2024 après l'avoir acheté en 2017, et Kitchen Stories, racheté à 65 % par BSH en 2018, est passé chez FUNKE Digital en 2025. La stratégie « app de recettes comme produit d'appel » n'a pas tenu. Ensuite, l'import IA depuis les réseaux sociaux est devenu standard en 2024-2025 (Honeydew, ReciMe, Pestle, Crouton) : ce n'est plus un argument de différenciation.

## 4. Pricing et économie unitaire

À 49,99 €/an, Cardamome est dans le haut de la fourchette des organiseurs, au niveau de Plan to Eat, ReciMe et Samsung Food+, et deux à trois fois au-dessus de Pestle, Honeydew ou Mealime. Prix publics relevés (devise d'origine, hors promotions) :

| App | Modèle | Prix annuel ou unique |
| --- | --- | --- |
| Cookidoo | Abonnement + appareil | 60 €/an (Allemagne) |
| ReciMe | Abonnement | 60 USD/an |
| Samsung Food+ | Abonnement | environ 60 USD/an (variable selon pays) |
| **Cardamome** | Abonnement | **49,99 €/an ou 4,99 €/mois** |
| Plan to Eat | Abonnement | 49 USD/an ou 5,95 USD/mois |
| Honeydew Plus | Abonnement | 39,99 USD/an ou 6,99 USD/mois |
| Pestle Pro | Abonnement ou à vie | 29,99-34,99 €/an ; 44,99-59,99 € à vie |
| Mealime Pro | Abonnement | 24,99 USD/an (une source indique 35,88) |
| Crouton | Achat + option | 24,99 USD unique ; Discover 14,99 USD/an |
| AnyList | Abonnement | 14,99 USD/an |
| Mela | Achat unique | 6,99 USD iOS ; 14,99 USD macOS |
| Paprika | Achat unique | 4,99 USD mobile ; 29,99 USD desktop |
| Jow | Gratuit | 0 (financé par les enseignes) |

**Ce qui reste d'un abonnement.** Calcul par abonné, TVA française 20 %, Stripe au tarif cartes européennes standard (1,5 % + 0,25 €).

| Poste | Mensuel 4,99 € | Annuel 49,99 € |
| --- | --- | --- |
| TVA | −0,83 € | −8,33 € |
| Stripe | −0,32 € | −1,00 € |
| Net avant IA, par mois | 3,84 € | 3,39 € |
| Via Google Play (15 % du HT) au lieu de Stripe | 3,54 € | 2,95 € |

**Le coût IA est le poste à surveiller.** Estimation, aux tarifs publics Anthropic (Haiku 4.5 : 1/5 USD par million de tokens en entrée/sortie ; Sonnet 5 : 2/10 USD) : un import texte d'environ 8 000 tokens en entrée et 2 500 en sortie coûte environ 0,02 USD ; un import photo (2 crédits) environ 0,04 USD. Un crédit vaut donc environ 0,02 USD dans les deux cas.

- Usage typique supposé (10 imports/mois) : environ 0,20 USD, soit autour de 5 % du net.
- Usage maximal autorisé (100 crédits/mois) : environ 2 USD, soit la moitié du net d'un abonné annuel.

Le quota de 100 crédits est donc généreux au regard de la marge, en particulier sur l'offre annuelle. Les volumes de tokens sont des hypothèses : les vraies valeurs sont dans le champ `usage` des réponses API et doivent remplacer ces estimations.

## 5. Différenciation

La différenciation réelle de Cardamome est sur la phase d'exécution (cuisiner, acheter juste) et sur l'ancrage français, pas sur la collecte ni sur l'IA. Mais rare ne veut pas dire valorisé : aucune de ces fonctionnalités n'a encore de preuve de disposition à payer.

| Fonctionnalité | Statut concurrentiel | Défendable ? |
| --- | --- | --- |
| Stockage, recherche, liste de courses, semainier, mise à l'échelle | Banalisé : présent partout, y compris dans les apps à achat unique | Non |
| Import IA (URL, photo, texte, PDF) | Banalisé depuis 2024-2025 (Honeydew, ReciMe, Pestle, Crouton, Samsung Food) ; coût d'entrée en baisse | Non |
| Partage de foyer temps réel | Courant (AnyList, Plan to Eat, Samsung Food) | Faible |
| Nutri-Score calculé depuis Ciqual, saisonnalité française | Rare : les concurrents anglo-saxons utilisent des bases USDA ou aucune | Moyen : données publiques, donc copiable, mais coûteux à localiser |
| Préparations de base avec rendement, éclatées dans les courses | Rare | Moyen |
| Mode cuisine : poste Découpe agrégé, glossaire de gestes, réglages d'appareil par étape | Rare hors Cookidoo (qui le fait pour un seul appareil) | Moyen : demande un référentiel éditorial (gestes, ustensiles) long à construire |
| Journal d'itérations versionné avec diff | Très rare | Faible en valeur perçue : utile à une minorité qui fait évoluer ses recettes |
| Stock relié au générateur de semaine | Partiel ailleurs (Samsung Food) | Faible |

Le seul actif véritablement cumulatif est le **référentiel éditorial** : base d'ingrédients Ciqual reliée, gestes techniques, ustensiles, précautions. Il s'enrichit avec le temps et un concurrent généraliste n'a pas d'incitation à le reconstruire pour le marché français.

Deux handicaps structurels. Pas de catalogue de contenu (Cookidoo revendique plus de 100 000 recettes, Marmiton domine la recherche), donc l'utilisateur doit apporter ses recettes. Et pas de présence forte dans les stores : une PWA ne bénéficie ni de la découverte App Store ni de la confiance associée.

### Le pari 100 % français

Le marché français ne convertit pas mieux que le marché américain : il convertit légèrement moins bien. Selon [RevenueCat](https://www.revenuecat.com/state-of-subscription-apps-2025), la conversion médiane téléchargement vers payant à 35 jours est de 2,0 % en Europe de l'Ouest contre 2,6 % en Amérique du Nord. Le revenu par installation y est aussi plus faible : l'Amérique du Nord fait environ 4 fois la moyenne mondiale à 14 jours.

L'avantage du français est ailleurs : la concurrence. Les organiseurs anglophones (Paprika, Honeydew, ReciMe, Plan to Eat) ne sont pas construits pour la France : unités, vocabulaire culinaire, saisons, données nutritionnelles Ciqual, Nutri-Score. Sur ce terrain, Cardamome affronte peu de produits directs ; Jow et Marmiton ne font pas le même métier. Le bon argument n'est donc pas « les Français paient mieux », mais « sur le français, je suis l'un des seuls ». Extension peu coûteuse à étudier : Belgique, Suisse et Québec, déjà couverts par la langue.

### L'import intelligent

L'import de Cardamome va plus loin que la simple extraction titre, ingrédients, étapes : il relie chaque ingrédient et ustensile au référentiel, extrait la découpe de chaque ingrédient et détecte les préparations de base avec leur rendement. Je n'ai pas testé les imports concurrents ; l'affirmation qu'ils « font le strict minimum » reste donc à démontrer, par exemple en important les mêmes 10 recettes dans 3 apps.

Sa valeur réelle est en aval : une recette importée arrive déjà reliée aux courses, à la nutrition et au mode cuisine, sans ressaisie. Le prompt est copiable par un concurrent ; le référentiel auquel il relie les données ne l'est pas. L'import est donc la porte d'entrée de l'avantage, pas l'avantage lui-même. Il a aussi une vraie valeur commerciale : c'est le moment où l'utilisateur voit le produit travailler pour lui. Mesure à suivre : le taux de passage à Cardamome+ dans les 7 jours qui suivent l'import offert.

### Une niche, avec une économie de niche

Viser une niche est cohérent avec ces chiffres. Les 12 000 à 40 000 €/an du scénario de la section 2 sont un échec pour une startup financée, mais un résultat viable pour un éditeur solo dont les coûts fixes restent bas. La niche à nommer : les cuisiniers francophones engagés, qui cuisinent depuis plusieurs sources et veulent exécuter, pas seulement stocker.

### Les créatrices de niche comme canal

C'est la meilleure réponse au problème central de cette analyse : le canal de distribution. Une créatrice spécialisée (C'est ma fournée, Cuisine à la grecque) parle exactement au public de la niche, avec une confiance qu'aucune publicité n'achète. Mais l'échange n'est pas gagnant-gagnant par défaut, et il faut le construire.

**Le conflit d'intérêts.** Une créatrice vit surtout des visites sur son blog (publicité) et de sa portée sur les réseaux. Une app qui extrait la recette évite à l'utilisateur de revenir sur le blog : sans contrepartie, Cardamome lui retire du trafic. Aujourd'hui, le code conserve l'URL d'origine de chaque recette importée (badge source sur le PDF et la vue publique), et les sources recommandées renvoient vers la page d'accueil de la créatrice. En revanche, aucun clic sortant n'est mesuré, et une recette importée peut être publiée dans Découvrir avec le texte et la photo de la créatrice.

**Le cadre juridique.** En France, une recette en tant que telle (ingrédients, suite d'instructions) relève du savoir-faire et n'est pas protégée par le droit d'auteur ; sa rédaction originale et ses photos le sont ([Dreyfus](https://www.dreyfus.fr/en/2016/07/08/how-to-protect-recipes-copyright-or-know-how/), [Le Petit Juriste](https://www.lepetitjuriste.fr/du-droit-a-lassiette-existe-t-il-une-protection-juridique-pour-les-creations-culinaires/)). L'import dans une bibliothèque privée est défendable ; la republication publique du texte et des photos ne l'est pas sans accord. À faire valider par un juriste avant de démarcher.

Ce qui rend l'échange réellement gagnant pour les deux :

| Ce que reçoit la créatrice | Mécanisme dans Cardamome | Mesure |
| --- | --- | --- |
| Du trafic retour, visible dans ses propres statistiques | Lien « Voir chez \[créatrice\] » bien visible sur chaque recette importée, avec un paramètre `?ref=cardamome` | Clics sortants par source et par mois |
| La protection de son contenu | Une recette importée d'une source tierce ne peut pas être publiée dans Découvrir, sauf accord de la créatrice | Zéro republication non autorisée |
| De la visibilité qualifiée | Mise en avant dans les sources recommandées (existe déjà), carnets officiels sur accord | Imports de ses recettes par mois |
| Un revenu, modeste | Code de parrainage par créatrice : par exemple 30 % de la première année, soit environ 12 € par abonné annuel amené | Abonnés attribués à chaque code |
| Un rapport | Bilan mensuel : X imports de vos recettes, Y clics vers votre site | Rapport envoyé |

Soyons lucides sur l'argent : à ce niveau de prix, la commission restera faible. L'argument pour la créatrice est d'abord le trafic retour et la visibilité, ensuite l'outil (Cardamome+ offert). Il doit être prouvé par les chiffres de clics, d'où la priorité de les mesurer avant de démarcher.

**Risques.** Chaque partenariat demande un effort manuel et ne passe pas à l'échelle seul. Une créatrice peut percevoir l'import comme de l'aspiration de contenu : le sujet doit être abordé en premier, pas découvert. Et la conversion d'une audience de créatrice est inconnue. D'où un pilote avec 2 ou 3 créatrices, mesuré en inscriptions et abonnés attribués par publication, avant d'étendre.

## 6. Positionnement recommandé

Ne pas affronter Jow sur « que mange-t-on ce soir » : il est gratuit et financé par les enseignes. Viser le cuisinier français engagé qui accumule des recettes de sources multiples (livres, blogs, réseaux, famille) et cuisine en foyer. Promesse : « vos recettes, vraiment cuisinables », l'exécution plutôt que la collecte. L'IA devient un moyen, pas le titre.

Chaque recommandation ci-dessous est une hypothèse à tester, avec son critère de décision :

| Action | Pourquoi | Mesure et seuil de décision |
| --- | --- | --- |
| Instrumenter avant tout : activation, rétention, conversion, coût IA par abonné | Aucune donnée d'usage n'existe aujourd'hui ; toutes les décisions suivantes en dépendent | Tableau de bord hebdomadaire en place |
| Définir l'activation, par exemple 10 recettes et 1 semaine planifiée en 7 jours | La rétention dépend de l'investissement initial dans la bibliothèque | Part des inscrits activés ; corrélation avec la rétention à 4 semaines |
| Pousser l'annuel en premier sur le paywall | RevenueCat : rétention à 12 mois de 44 à 54 % sur l'annuel contre 20 à 40 % sur le mensuel | Part annuel / mensuel ; revenu par inscrit |
| Tester une offre à vie (par exemple 99 €) | Pestle le fait ; capte les acheteurs ancrés sur Paprika ou Mela qui refusent l'abonnement | Revenu par inscrit sur 90 jours, par variante |
| Tester un essai gratuit long (14 à 30 jours) | RevenueCat : les essais de 17 à 32 jours convertissent à 42,5 % en médiane, contre 25,5 % sous 4 jours | Taux essai vers payant |
| Ramener le quota IA vers l'usage réel (par exemple au 95e centile mesuré) | Au plafond actuel, l'IA peut absorber la moitié du net annuel | Coût IA / revenu net inférieur à 15 % |
| Faire du foyer la boucle d'acquisition | Chaque foyer abonné amène au moins un second utilisateur sans coût | Invitations envoyées et acceptées par foyer |
| Exploiter les pages de recettes publiques (aperçu riche déjà en place) comme canal SEO et social | C'est le seul canal de distribution gratuit déjà construit | Visites et inscriptions venant des liens partagés |

Ce qu'il faut cesser : ajouter des fonctionnalités sans mesure. Le produit couvre déjà plus de maillons que ses concurrents ; la contrainte est la distribution et la preuve de valeur, pas le périmètre.

Questions ouvertes, à trancher avec les données :

- Combien d'utilisateurs actifs, et quelle conversion gratuit vers payant aujourd'hui ?
- Quelle fonctionnalité est utilisée juste avant un passage à Cardamome+ ?
- Quel est l'usage réel des crédits IA (médiane, 95e centile) ?

## Sources

Relevées par recherche web le 3 octobre 2026. Les chiffres cités viennent des extraits de ces pages : à revérifier sur la page source avant tout usage externe (présentation, levée de fonds).

- Marché : [Spherical Insights, recipe apps market](https://www.sphericalinsights.com/blogs/top-25-companies-in-global-recipe-apps-market-worldwide-2025-market-research-report-2026-2035) ; [GII / Technavio, recipe apps market](https://www.giikorea.co.kr/report/infi1626788-global-recipe-apps-market.html)
- Jow : [Minted, Jow et le retail media](https://www.mntd.fr/jow-un-nouvel-acteur-du-retail-media-qui-ne-manque-pas-d-appetit-755661/) ; [Owler, profil Jow](https://www.owler.com/company/jow1)
- ReciMe : [SmartCompany, de 20 000 à 400 000 utilisateurs](https://uatcdn.smartcompany.com.au/?p=284926)
- Cookidoo : [Dr. Web, Cookidone et Thermomix](https://www.drweb.de/cookidone-vorwerk-ki-kochassistent-thermomix/)
- Marmiton : [The Media Leader, audiences Internet](https://fr.themedialeader.com/?p=49362) ; [Ahrefs, marmiton.org](https://ahrefs.com/top/marmiton.org)
- Yummly : [Wikipedia](https://en.wikipedia.org/wiki/Yummly) ; [The Spoon](https://thespoon.tech/whirlpool-lays-off-entire-team-for-cooking-and-recipe-app-yummly)
- Kitchen Stories : [BSH, prise de participation majoritaire](https://www.bsh-group.com/us/press/press-releases/bsh-hausgeraete-gmbh-acquires-majority-stake-in-kitchen-stories-global-food-platform)
- Prix : [Paprika (App Pricing Lab)](https://apppricinglab.com/app/apple/1303222868) ; [Mela (RecipeSage)](https://recipesage.com/alternatives/mela/) ; [Crouton (RecipeSage)](https://recipesage.com/alternatives/crouton/) ; [Honeydew (App Store)](https://apps.apple.com/us/app/-/id6714449541) ; [Pestle (App Store)](https://apps.apple.com/DE/app/id1574776971) ; [Plan to Eat](https://learn.plantoeat.com/doc/how-much-does-plan-to-eat-cost) ; [Samsung Food (Stuff)](https://stuff.co.za/?p=197896) ; [Mealime, AnyList (comparatif)](https://haznos.org/best-meal-planning-app-2026/)
- Open source : [Cooklang, Tandoor vs Mealie vs KitchenOwl](https://cooklang.org/blog/42-tandoor-vs-mealie-vs-kitchenowl/)
- Benchmarks d'abonnement : [RevenueCat, State of Subscription Apps 2025](https://www.revenuecat.com/state-of-subscription-apps-2025) ; [RocketShip HQ, synthèse](https://www.rocketshiphq.com/revenuecat-state-of-subscription-apps-2025-summary/)
- Frais : [Stripe, tarifs EEE](<https://support.stripe.com/questions/pricing-updates-for-businesses-based-in-the-european-economic-area-(eea)>) ; [Google Play, commission de 15 % sur les abonnements](https://appleinsider.com/articles/21/10/21/google-play-drops-all-subscription-commissions-to-15-from-day-one) ; [Apple, Small Business Program](https://www.businesswire.com/news/home/20201118005376/en/Apple-Announces-App-Store-Small-Business-Program)
- Tarifs Claude (Haiku 4.5, Sonnet 5) : grille publique Anthropic au 25 septembre 2026
- Produit : code source de Cardamome v4.59.13 (README, `functions/src/imports/recipeImport.ts`, docs Stripe)
