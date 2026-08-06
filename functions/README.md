# Cloud Functions — Mijoté

Fonctions déployées :

- **`importRecipeFromUrl`** / **`importRecipeFromImages`** — import d'une recette
  depuis une URL ou 1–2 photos. Accès vérifié **côté serveur** (admin illimité,
  abonné Mijoté+ avec quotas jour/mois).
- **`createStripeCheckout`** / **`createStripePortal`** / **`stripeWebhook`** —
  paiement Mijoté+ (intégration Stripe maison).

## Structure & build (TypeScript)

Le code source est en **TypeScript** dans `functions/src/` et compilé vers
`functions/lib/` (ignoré par git). Node exécute le JS compilé (`lib/index.js`),
jamais le `.ts` directement.

```bash
cd functions
npm install       # installe aussi typescript, @types/node, typedoc
npm run build     # tsc → lib/
npm run docs      # TypeDoc → functions/docs/ (documentation d'API)
```

Le déploiement recompile automatiquement via le hook `predeploy` de
`firebase.json` (`npm --prefix functions run build`) — pas besoin de builder à la
main avant `firebase deploy`. Les tests (`*.test.ts`) tournent avec Vitest à la
racine (`npm test`) et sont exclus de la compilation.

Le code est organisé par **domaine** :

| Module | Rôle |
| --- | --- |
| `src/index.ts` | **Point d'entrée** : ré-exporte les fonctions déployées (aucune logique) |
| `src/imports/recipeImport.ts` | Handlers d'import (onCall) : URL / photo |
| `src/imports/recipeExtract.ts` | Mise en forme pure du brouillon (ids, `_raw`, liaisons) |
| `src/subscriptions/stripe.ts` | Checkout / portail / webhook Stripe |
| `src/subscriptions/stripeHelpers.ts` | Helpers purs abonnement (sans I/O) |
| `src/quota/access.ts` | Contrôle d'accès + consommation de quota (transaction) |
| `src/quota/quota.ts` | Limites & logique de quota (pure) |

## Fonctionnement

1. Vérifie que l'appelant est authentifié **et** que son e-mail == `ADMIN_EMAIL`.
2. Télécharge la page côté serveur (pas de CORS, UA navigateur, taille/temps bornés).
3. Envoie le texte de la page à **Claude Haiku 4.5** → JSON (le chemin JSON-LD a été
   abandonné : à qualité de rendu, Haiku est nettement meilleur — étapes reformulées à
   l'infinitif, quantités estimées, liaisons ingrédients/ustensiles).
4. Renvoie `{ recipe, method: "llm" }`. Le client relit/corrige dans l'éditeur.

Le brouillon renvoyé porte : ids stables, `_raw` éditable par ingrédient, liaisons
ingrédients/ustensiles ↔ étapes, images d'étape pertinentes, image principale via
`og:image`, style de cuisine rapproché de la liste Mijoté.

### Modifier le prompt d'extraction

Le prompt système est dans **`functions/prompts/recipeExtract.md`** (les listes de
cuisines et d'ustensiles y sont injectées via `{{CUISINE_LIST}}` / `{{UTENSILS}}`).
Après édition : `firebase deploy --only functions` (le prompt vit dans la fonction).

## Prérequis

- **Plan Blaze** (pay-as-you-go) sur le projet Firebase (les Cloud Functions v2 l'exigent).
  Le palier gratuit couvre largement cet usage.
- Une **clé API Anthropic** (console.anthropic.com).

## Configuration & déploiement

```bash
# 1. Dépendances
cd functions && npm install && cd ..

# 2. E-mail autorisé (le créateur) — paramètre non secret, lu depuis functions/.env
echo "ADMIN_EMAIL=ton.email@exemple.com" > functions/.env

# 3. Clé API Anthropic — SECRET (jamais dans le code ni le bundle)
firebase functions:secrets:set ANTHROPIC_API_KEY
#    (colle la clé sk-ant-... quand demandé)

# 4. Déploiement
firebase deploy --only functions
```

> `ADMIN_EMAIL` doit correspondre à `VITE_ADMIN_EMAIL` côté client (même e-mail).
> Région : **`europe-west1`** (alignée entre `functions/src/index.ts` et
> `getFunctions(firebaseApp, "europe-west1")` dans `src/lib/firebase.js`).

## Émulateur (test local)

```bash
firebase emulators:start --only functions
```

Pour que le client tape l'émulateur en local, ajouter dans `src/lib/firebase.js`
(en dev uniquement) : `connectFunctionsEmulator(functions, "localhost", 5001)`.

## Coût

- Chemin JSON-LD : **gratuit** (aucun appel LLM), couvre la majorité des sites connus.
- Chemin LLM (fallback) : Haiku 4.5 à 1 $/5 $ par million de tokens → **< 1 centime**
  par import (page bornée à ~24k caractères en entrée, ~1k tokens en sortie).
