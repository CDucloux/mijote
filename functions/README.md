# Cloud Functions — Mijoté

Une seule fonction pour l'instant : **`importRecipeFromUrl`** — importe une recette
depuis une URL. Réservée au créateur (garde côté serveur sur l'e-mail du token Auth).

## Fonctionnement

1. Vérifie que l'appelant est authentifié **et** que son e-mail == `ADMIN_EMAIL`.
2. Télécharge la page côté serveur (pas de CORS, UA navigateur, taille/temps bornés).
3. **JSON-LD schema.org/Recipe** présent → mapping direct (gratuit, déterministe).
4. Sinon → texte de la page envoyé à **Claude Haiku 4.5** (structured outputs) → JSON.
5. Renvoie `{ recipe, method: "jsonld" | "llm" }`. Le client relit/corrige dans l'éditeur.

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
> Région : `us-central1` (par défaut). Si tu changes de région, ajuste aussi
> `getFunctions(firebaseApp, "<région>")` dans `src/lib/firebase.js`.

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
