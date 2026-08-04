# Paiement Mijoté+ — extension Firebase Stripe

Le front est câblé pour l'extension officielle **`firestore-stripe-payments`**
(Invertase/Stripe). Toute la logique de paiement (Checkout, webhooks, statut
d'abonnement) vit dans l'extension ; l'app ne fait qu'écrire/écouter des documents
Firestore. Étapes de configuration côté projet (à faire une fois) :

## 1. Compte & produits Stripe
1. Créer un compte Stripe, récupérer la **clé secrète** (`sk_…`).
2. Créer un produit **Mijoté+** avec deux tarifs récurrents :
   - **Mensuel** : 3,99 €/mois → note l'ID `price_…`
   - **Annuel** : 29,99 €/an → note l'ID `price_…`

## 2. Installer l'extension
Firebase Console → Extensions → **Run Payments with Stripe**
(`firestore-stripe-payments`). Pendant l'installation :
- **Products/Pricing & subscriptions collection** : laisser `products` / `customers`
  (valeurs par défaut attendues par le front).
- **Stripe API key** : la clé secrète (via Secret Manager).
- **Sync new users** : activer la synchro auto des utilisateurs vers des clients Stripe.
- Après installation, configurer le **webhook Stripe** avec l'URL fournie par
  l'extension (elle indique les événements à cocher) et coller le **signing secret**.

L'extension déploie aussi les **règles Firestore** pour `customers/{uid}/…`
(lecture de ses propres abonnements). Vérifier qu'elles sont bien en place.

## 3. Variables d'environnement du front
Dans le `.env` (préfixe `VITE_`) :

```
VITE_STRIPE_PRICE_MONTHLY=price_xxx   # tarif mensuel
VITE_STRIPE_PRICE_YEARLY=price_yyy    # tarif annuel
# Optionnel — seulement si l'extension n'est pas en us-central1 :
VITE_STRIPE_EXT_REGION=us-central1
```

Tant que ces variables sont absentes, le bouton « Passer à Mijoté+ » affiche
simplement « arrive bientôt » (aucun appel Stripe).

## 4. Comment ça marche côté app
- **Statut** : `useSubscription(uid)` écoute `customers/{uid}/subscriptions`
  (statut `active`/`trialing`) → `isPlus = isAdmin || abonné`.
- **Achat** : le CTA écrit un doc dans `customers/{uid}/checkout_sessions` ;
  l'extension y renvoie l'`url` de Stripe Checkout → redirection.
- **Gestion** : « Gérer mon abonnement » appelle la fonction
  `ext-firestore-stripe-payments-createPortalLink` (portail de facturation Stripe).
- **Retour** : `success_url = /plus?checkout=success` → message de bienvenue ;
  le statut bascule dès que le webhook a créé l'abonnement.

## Test
Utiliser le **mode test** de Stripe (clés `sk_test_…`, carte `4242 4242 4242 4242`)
avant de passer en production.
