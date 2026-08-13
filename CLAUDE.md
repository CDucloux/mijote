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

## 4. Tests : `src/lib/` et backend, tests unitaires obligatoires, non négociable
- **Tout ajout ou modification** dans `src/lib/` ou `functions/src/` s'accompagne de **tests unitaires** (Vitest), y compris un test de non-régression pour chaque bug corrigé.
- Tester les cas limites (vide, null, données externes malformées), pas seulement le chemin heureux.
- `npm test` doit être vert avant de considérer un travail terminé.
- L'UI (`.jsx`) n'exige pas de test unitaire systématique, mais la **logique** qu'elle utilise doit vivre (et être testée) dans `src/lib/`.

## 5. Commentaires & documentation
- **Docstrings TypeDoc** (`/** … */`) sur les fonctions/exports du backend et de `src/lib/` : décrire le **POURQUOI** et le contrat (params, retour, effets), **jamais le COMMENT** (le code dit déjà comment).
- **Ne pas raconter sa vie** : pas de narration, pas de commentaire redondant qui paraphrase le code.
- Un **commentaire ponctuel** est justifié uniquement pour un **détail d'implémentation non évident** à un endroit précis (piège, contournement, invariant subtil), bref et ciblé.

## 6. Qualité avant de finir (checklist)
Avant de considérer une tâche terminée :
1. `npm run lint` → **0 erreur** (`no-unused-vars` est une ERREUR ; les warnings `react-hooks/*` pré-existants sont tolérés).
2. `tsc --noEmit` → OK.
3. `vite build` → OK.
4. `npm test` → vert (avec les nouveaux tests si `lib`/backend touchés).

## 7. Git & mise en prod (MEP)
- Développer sur la branche de feature, jamais directement sur `main`.
- **MEP** = bump version (`package.json` + `package-lock.json`) + entrée en tête de `CHANGELOG.md` + merge `--no-ff` vers `main` + push des deux branches. Ne MEP que sur demande explicite.
- Les changements **Cloud Functions** ne sont actifs qu'après un déploiement manuel (`cd functions && npm run deploy`), le préciser.
- Ne jamais commiter de secret (`sk_live_`, `whsec_`, clés API) : ils vivent dans les secrets Firebase / variables d'environnement.

## 8. Typographie : tirets cadratins bannis
- **Aucun tiret cadratin (« — », caractère U+2014) nulle part, sans exception** : code, commentaires, docstrings, documentation (CLAUDE.md, README, CHANGELOG…), UI/front, messages de commit. Si tu en vois un, tu le retires, où qu'il soit.
- Remplacer selon le contexte par une virgule, un point, des parenthèses, des deux-points, ou à défaut un tiret simple (`-`) pour une liaison courte.
