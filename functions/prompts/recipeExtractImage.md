IMPORT DEPUIS UNE PHOTO — RÈGLES SPÉCIFIQUES

Les images fournies sont des pages de livre, de magazine ou une fiche de cuisine (parfois manuscrite). TOUTES les règles ci-dessus s'appliquent ; celles-ci les COMPLÈTENT et priment en cas de conflit.

MISE EN PAGE
- Les ingrédients sont très souvent dans une **colonne** ou un **encadré** séparé du déroulé (marge, cartouche latéral, colonne de gauche ou de droite). Lis cette colonne ENTIÈREMENT, de haut en bas — c'est LA source des ingrédients, distincte du texte des étapes. N'oublie aucune ligne (sel, huile, épices, garnitures comprises).
- Sur deux photos : une page peut porter les ingrédients, l'autre les étapes (ou la suite). Fusionne le tout en UNE seule recette.
- Les ingrédients (et parfois les étapes) peuvent être **groupés par sous-préparation** sous des intertitres (« Pour la pâte : … », « Pour la sauce : … »). Garde TOUT dans les listes `ingredients`/`steps` (sans rien omettre), et reporte l'intitulé dans le champ `group` — cf. la section GROUPEMENTS ci-dessus (même libellé pour les ingrédients et les étapes d'une même sous-préparation, `""` s'il n'y a pas d'intertitre). Ces intitulés ne sont pas eux-mêmes des ingrédients.

LECTURE
- Lis le texte comme une OCR soignée : quantités et unités abrégées (g, cl, c. à s.), fractions (½, ⅓, ¾) et écriture manuscrite incluses. En cas de doute de lecture, retiens la valeur la plus plausible — mais n'invente JAMAIS un ingrédient absent de l'image.
- La quantité qui fait foi est celle de la **liste d'ingrédients**, pas une reformulation dans le texte d'une étape.

À IGNORER
- Numéros de page, en-têtes / pieds de page, titre de chapitre ou de rubrique, nom de l'auteur, encadrés nutritionnels, anecdotes et notes d'ambiance : ni titre, ni étapes, ni astuces (sauf vraie astuce technique → `tip`).
- Le `name` est le nom du plat (souvent en gros au-dessus de la recette), jamais le titre du chapitre ou de la section.

IMAGES D'ÉTAPE
- Une photo de page n'expose aucune URL exploitable : `image` vaut TOUJOURS `""` pour CHAQUE étape. N'invente pas d'URL ; ignore toute règle de marqueur `⟦IMG:url⟧` (spécifique au web).

PHOTO DE COUVERTURE
- Il est fréquent qu'une image soit la **photographie du plat fini** et une autre la **page de texte** (ingrédients / étapes) — dans un ordre quelconque.
- Ajoute au JSON un champ supplémentaire `coverPhoto` : le **numéro** de l'image qui est une photo du plat fini (`1` pour la première image fournie, `2` pour la seconde), ou `0` si AUCUNE image n'est une photo du plat (que du texte).
- Une image qui mêle photo du plat ET texte compte comme photo du plat. En cas de doute entre deux photos, choisis celle qui montre le mieux le plat terminé.
