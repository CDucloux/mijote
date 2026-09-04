# Paiement Cardamome+ : intégration Stripe maison

Le paiement **ne dépend PAS** de l'extension Firebase (`firestore-stripe-payments`),
annoncée en fin de vie (arrêt mars 2027). Tout vit dans nos propres Cloud Functions
(`functions/stripe.js`) :

| Fonction | Type | Rôle |
| --- | --- | --- |
| `createStripeCheckout` | callable | crée une session Stripe Checkout (abonnement) → renvoie l'URL |
| `createStripePortal` | callable | ouvre le portail de facturation Stripe → renvoie l'URL |
| `stripeWebhook` | HTTP | Stripe → Firestore : écrit le statut d'abonnement |

Le front (`src/lib/firebase/subscription.ts`) appelle les deux callables et écoute
`customers/{uid}/subscriptions` (statut `active`/`trialing`) pour débloquer Cardamome+.
Le lien uid Firebase ↔ client Stripe est stocké dans `customers/{uid}.stripeId` et
dupliqué en métadonnée Stripe (`firebaseUID`). Région des fonctions : `europe-west1`.

## 1. Produits Stripe (déjà fait)
Un produit **Cardamome+** avec deux tarifs récurrents : **4,99 €/mois** et **49,99 €/an**.
Noter les deux identifiants `price_…` (bien ceux du **mode test** pour tester).

## 2. Secrets côté fonctions
Depuis la racine du projet :
```bash
firebase functions:secrets:set STRIPE_SECRET_KEY      # coller sk_test_… (puis sk_live_… en prod)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET  # coller whsec_… (obtenu à l'étape 4)
```

## 3. Déployer les fonctions
```bash
firebase deploy --only functions
```
Le déploiement installe la dépendance `stripe` et publie les 3 fonctions. Récupère
l'URL publique de `stripeWebhook` affichée à la fin (forme
`https://europe-west1-<projet>.cloudfunctions.net/stripeWebhook`).

## 4. Webhook Stripe
Stripe → **Développeurs → Webhooks → + Ajouter un endpoint** :
- **URL** : celle de `stripeWebhook` (étape 3).
- **Événements** : `checkout.session.completed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`.
- Créer, copier le **Signing secret** `whsec_…`, le poser via `functions:secrets:set`
  (étape 2) puis **re-déployer** (`firebase deploy --only functions`) pour que le
  secret soit pris en compte.

## 5. Règles Firestore
`firestore.rules` autorise chaque utilisateur à LIRE `customers/{uid}` et
`customers/{uid}/subscriptions/**` ; l'écriture est réservée au serveur (webhook via
Admin SDK). Déployer si besoin :
```bash
firebase deploy --only firestore:rules
```

## 6. Variables d'environnement du front
Dans `.env.local` (préfixe `VITE_`, **baké au build** → rebuild après) :
```
VITE_STRIPE_PRICE_MONTHLY=price_…   # tarif mensuel
VITE_STRIPE_PRICE_YEARLY=price_…    # tarif annuel
# Optionnel : seulement si les fonctions ne sont PAS en europe-west1 :
# VITE_STRIPE_EXT_REGION=europe-west1
```
Tant que ces prix sont absents, le CTA « Passer à Cardamome+ » affiche « arrive bientôt ».

## 7. Test de bout en bout (mode test)
- `/plan` → « Passer à Cardamome+ » → Stripe Checkout.
- Carte de test `4242 4242 4242 4242`, date future, CVC quelconque.
- Retour sur `/plan?checkout=success` → `isPlus` bascule dès que le webhook a écrit
  l'abonnement (quelques secondes).
- « Gérer » → portail de facturation Stripe.

## Passage en production
Refaire produits/tarifs en **mode live**, poser les secrets `sk_live_…` /
`whsec_…` (live), recréer le webhook sur l'URL live, et mettre les `price_…` live
dans les variables d'env de build.
