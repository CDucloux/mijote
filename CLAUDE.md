# CLAUDE.md : Règles de contribution (à respecter scrupuleusement)

Mijoté : PWA React 19 + Vite + Firebase (Auth/Firestore/Functions), déployée sur Vercel.
Ces règles priment sur toute habitude par défaut. En cas de doute, demander.

## 1. Clean code & architecture : priorité absolue
La dette technique est l'ennemi. Chaque changement doit **réduire ou maintenir** l'entropie, jamais l'augmenter.
- **Séparation stricte des couches** : logique métier dans `src/lib/` (pur, sans I/O, sans React) ; accès données dans `src/lib/firebase/` ; UI dans `src/components` / `src/pages` ; orchestration dans `src/hooks`. Ne pas faire remonter de la logique métier dans le JSX.
- **Fonctions pures et petites**, une seule responsabilité. Viser **< 400 lignes par fichier** ; au-delà, découper par responsabilité.
- **Pas de duplication** : factoriser dès la 2ᵉ occurrence (helper, composant, hook).
- **Nommage explicite**, français côté domaine métier quand c'est déjà la convention du fichier.
- Lire le code alentour et **en épouser le style** (idiomes, conventions, densité) avant d'écrire.

## 2. Typage : `src/lib/` et backend, TypeScript TOUJOURS, non négociable
- Tout code dans `src/lib/` et `functions/` est en **TypeScript fortement typé**. Interdits : `any` implicite ou explicite (préférer `unknown` + narrowing), types manquants sur les signatures publiques, casts non justifiés.
- Les payloads externes (réponse LLM, données Firestore, entrées réseau) sont typés `unknown` puis validés/narrowés, jamais castés à l'aveugle.
- `tsc --noEmit` doit passer (0 erreur). `strict` est activé, il le reste.

## 3. Frontend : UI/UX ULTRA SLEEK & MODERNE, standard designer 2026
L'interface doit avoir le niveau d'un **produit conçu par un designer UI/UX senior en 2026** : épurée, cohérente, raffinée.
- **Pills > boutons carrés/moches.** Formes arrondies, coins doux, hiérarchie visuelle claire.
- **Tokens de design** (`var(--…)`) plutôt que des couleurs en dur ; réutiliser les primitives existantes.
- Micro-interactions natives (ripple mobile, pressable, transitions douces), respect du thème sombre/clair et des safe-areas.
- Jamais de rendu « brut » ou d'état vide non soigné : squelettes/spinners pendant le chargement, états vides travaillés.
- Mobile-first : penser tactile, cibles suffisantes, feedback immédiat.

### 3.1 Anti-look « vibe-codé » : bannir les tells de l'IA
Le fil rouge : une IA recrache la **moyenne** de ses données d'entraînement ; le bon design fait des choix **spécifiques** au produit (Mijoté = cuisine, chaleur, gourmandise), à l'utilisateur et au contexte. Chaque défaut laissé tel quel crie « fait avec une IA ». À proscrire :
- **Pas de gradient violet / bleu-violet** (hero, fonds, boutons) : c'est LE drapeau « fait par IA ». Fonds plats, une couleur d'accent assumée tirée des tokens.
- **Pas d'emoji comme système d'icônes** (nav, puces, en-têtes, boutons) : un set d'icônes cohérent (même famille, poids, taille). L'emoji reste toléré dans le contenu / la microcopy quand le ton s'y prête, jamais comme brique d'UI.
- **Pas de palette néon ni de 5-6 couleurs saturées qui se battent** : la couleur est une ressource partagée à budgéter globalement (une dominante, un accent, un neutre). L'emphase vient du contraste et de la retenue, pas de l'accumulation.
- **Pas de glow / aurora / blur décoratif** en sombre : la profondeur du dark mode naît de la typo, du contraste et des niveaux de surface. Un effet qui ne traduit ni interaction, ni statut, ni hiérarchie dégage.
- **Pas de cartes empilées à l'infini** (carte dans une carte dans une carte) : la card est réservée à ce qui est **indépendamment actionnable**. Sinon, grouper par blanc, proximité et typo.
- **Pas de barres latérales multicolores ni de status dots décoratifs** : un indicateur ne vit que s'il **mappe un état défini et compréhensible** ; sinon, un label texte ou rien.
- **Pas de tout-centré en colonne unique** : structure, grille, alignement sur un bord ; corps de texte aligné à gauche en colonnes lisibles (~60-80 caractères) ; largeurs variées (tableaux au large, lecture en colonne étroite), asymétrie bienvenue.
- **Pas d'une seule fonte à poids unique** : la hiérarchie naît du **contraste** typographique (un titre gros et fort, un corps discret, un vrai écart entre les deux) ; une fonte à caractère sur les titres fait déjà l'essentiel du travail.
- **Pas d'espacement uniforme** (mécanique) : un rythme intentionnel, serré pour grouper ce qui va ensemble, moyen pour séparer les sections, généreux autour de ce qui compte. Le blanc lu comme de la confiance.
- **Pas de microcopy placeholder** (« Submit », « Erreur », « Aucune donnée ») : écrire boutons, états et messages comme on les dirait, une seule voix cohérente de bout en bout.
- **Pas d'image IA à la « sheen » plastique** (mains ratées, doigts en trop) : vraie photo, pas d'image du tout, ou génération sous contraintes strictes.

Deux principes qui font vraiment basculer :
- **Hiérarchie assumée** : sur chaque écran, un élément **domine** (taille, couleur, contraste, position). L'action principale (CTA) est la plus contrastée, le reste décroît. Si tout a le même poids, rien ne ressort.
- **Le détail fait-main** : ajouter **un** détail qu'aucun template par défaut ne produirait (une micro-interaction, une forme, une touche soignée), la signature humaine qui fait lire l'ensemble comme « conçu par quelqu'un qui y tient ». Un seul suffit, mais il compte.

## 4. Tests : `src/lib/` et backend, tests unitaires obligatoires, non négociable
- **Tout ajout ou modification** dans `src/lib/` ou `functions/src/` s'accompagne de **tests unitaires** (Vitest), y compris un test de non-régression pour chaque bug corrigé.
- Tester les cas limites (vide, null, données externes malformées), pas seulement le chemin heureux.
- `npm test` doit être vert avant de considérer un travail terminé.
- L'UI (`.jsx`) n'exige pas de test unitaire systématique, mais la **logique** qu'elle utilise doit vivre (et être testée) dans `src/lib/`.
- **Pas de repros navigateur** (Playwright, montage d'un harness, captures d'écran pour « vérifier » un rendu) : c'est interdit. Ça n'apporte quasiment rien et ça consomme énormément de tokens. La validation passe par les tests unitaires (`src/lib/`), `tsc`, le lint et le build ; le rendu visuel se vérifie côté utilisateur. Se limiter au raisonnement CSS/JSX pour les changements d'UI.

## 5. Commentaires & documentation
- **Docstrings TypeDoc** (`/** … */`) sur les fonctions/exports du backend et de `src/lib/` : décrire le **POURQUOI** et le contrat (params, retour, effets), **jamais le COMMENT** (le code dit déjà comment).
- **Ne pas raconter sa vie** : pas de narration, pas de commentaire redondant qui paraphrase le code.
- Un **commentaire ponctuel** est justifié uniquement pour un **détail d'implémentation non évident** à un endroit précis (piège, contournement, invariant subtil), bref et ciblé.

## 6. Qualité avant de finir (checks proportionnels au diff)
Ne PAS tout relancer à chaque petite modif : c'est overkill et `vite build` (lent, sortie très verbeuse) coûte cher en tokens pour rien sur un petit changement. On lance **uniquement ce que le diff peut casser** :
- **CSS uniquement** : rien d'automatique (eslint ne lint pas le CSS, `tsc` ne le voit pas, une erreur CSS ne casse quasi jamais le build). Raisonner sur le CSS. Au pire un `vite build` en fin de session si gros remaniement de styles.
- **JSX/UI sans logique métier** : `tsc --noEmit` + `npm run lint`. Pas de build.
- **`src/lib/` ou `functions/src/`** : `tsc --noEmit` + `npm test` (au moins la zone touchée, avec les nouveaux tests) + `npm run lint`.
- **Imports transverses, dépendances, config Vite/TS** : ajouter `vite build` (c'est là qu'il attrape vraiment quelque chose : chaîne d'imports/bundling).

Règles transverses :
- `npm run lint` → **0 erreur** dès qu'on touche du JS/JSX/TS (`no-unused-vars` est une ERREUR ; les warnings `react-hooks/*` pré-existants sont tolérés).
- `tsc --noEmit` est quasi gratuit et silencieux quand c'est vert : c'est le gardien par défaut dès qu'on touche du TS/TSX.
- **La checklist COMPLÈTE (`npm run lint` + `tsc --noEmit` + `vite build` + `npm test`) est obligatoire et non négociable à la MEP** (cf. §7) et avant tout merge vers `main` : là, c'est le dernier filet avant prod.

## 7. Git & mise en prod (MEP)
- Développer sur la branche de feature, jamais directement sur `main`.
- **MEP** = bump version (`package.json` + `package-lock.json`, **impérativement via `npm version <x.y.z> --no-git-tag-version`** qui met à jour les deux fichiers en une passe : ne jamais lire ni éditer `package-lock.json` à la main, il fait ~11 500 lignes et sa lecture explose le coût en tokens) + entrée en tête de `CHANGELOG.md` (**ne lire que ses ~30 premières lignes** pour en épouser le format, puis insérer au sommet : ne jamais charger le fichier entier, il fait plus de 1000 lignes) + **mise à jour du `README.md`** (badge de version en tête, et tout passage du README devenu obsolète au vu du diff : fonctionnalités, architecture, scripts…) + merge `--no-ff` vers `main` + push des deux branches. Ne MEP que sur demande explicite.
- Les changements **Cloud Functions** ne sont actifs qu'après un déploiement manuel (`cd functions && npm run deploy`), le préciser.
- Ne jamais commiter de secret (`sk_live_`, `whsec_`, clés API) : ils vivent dans les secrets Firebase / variables d'environnement.

## 8. Typographie : tirets cadratins bannis
- **Aucun tiret cadratin (le tiret long typographique, caractère Unicode U+2014) nulle part, sans exception** : code, commentaires, docstrings, documentation (CLAUDE.md, README, CHANGELOG…), UI/front, messages de commit. Si tu en vois un, tu le retires, où qu'il soit, y compris dans ce fichier, qui ne doit lui-même jamais en contenir.
- Remplacer selon le contexte par une virgule, un point, des parenthèses, des deux-points, ou à défaut un tiret simple (`-`) pour une liaison courte.

## 9. Économie de contexte : suggérer /clear et /compact
Le quota d'usage se compte en tokens traités, et chaque tour renvoie tout le contexte : plus la fenêtre est pleine, plus chaque action coûte cher. Claude ne peut pas lancer ces commandes lui-même, mais il DOIT les suggérer à l'utilisateur aux bons moments, **avec parcimonie** : uniquement aux points de coupure naturels, jamais en boucle ni en plein milieu d'une action.
- Suggérer **`/clear`** (reset total, gain maximal) quand la continuité ne sert plus : une tâche est terminée et la suivante est indépendante ; juste avant une MEP si le dev qui précède est inutile à la suite ; après une longue session de debug/exploration une fois la conclusion actée.
- Suggérer **`/compact`** (garde un résumé, jette le bruit) quand il faut continuer la MÊME tâche mais que le contexte est lourd : gros fichiers lus ou sorties verbeuses accumulées ; fenêtre de contexte qui approche d'un seuil élevé (~60-70 %) en cours de tâche ; bug compris après beaucoup de tâtonnements.
