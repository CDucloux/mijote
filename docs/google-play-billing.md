# Paiement Cardamome+ : Google Play Billing (spec d'intégration)

> Statut : **spec, non implémentée.** Ce document cadre l'ajout du paiement in-app
> Android **avant** d'écrire une ligne de code, pour ne rien casser de l'existant
> Stripe. À lire avec `docs/stripe-mijote-plus.md` (le socle) sous les yeux.

## 0. Pourquoi ce chantier

Le checkout actuel est **Stripe (web)**. Google interdit de vendre un bien
numérique consommé **dans** l'app Android par un autre moyen que **Play Billing** :
laisser un paiement Stripe in-app expose au retrait du Store. Il faut donc un
**achat natif Play Billing** sur Android, **réconcilié** avec Stripe pour qu'un
seul accès `isPlus` vaille quel que soit le canal d'achat.

**Décisions actées** (voir aussi §11) :
- Achat in-app natif Play Billing sur Android (pas de simple lien web).
- **Play Billing brut + vérification maison** (Cloud Function + Google Play
  Developer API + RTDN Pub/Sub), zéro dépendance tierce payante, dans la droite
  ligne du choix « Stripe maison sans l'extension Firebase ».

## 1. Invariant central : une seule source de vérité `isPlus`

L'accès Cardamome+ se lit **aujourd'hui** en un seul endroit logique, côté front
comme côté serveur, par une requête identique :

```
customers/{uid}/subscriptions  where status in ["active","trialing"]
```

- Front : `subscribeToPlan` (`src/lib/firebase/subscription.ts`) → `useSubscription`.
- Serveur : `requireAccess` (`functions/src/quota/access.ts`), qui garde les imports IA.
- Écriture : **serveur uniquement** (`allow write: if false` dans `firestore.rules`),
  aujourd'hui par le seul `stripeWebhook`.

**Principe directeur de la réconciliation :** Play **n'introduit pas** de nouveau
chemin de lecture. La fonction de vérification Play écrit des documents **de même
forme** (`SubscriptionDocFields`) dans **la même** sous-collection
`customers/{uid}/subscriptions`, avec un discriminant `channel`. Résultat :

- `subscribeToPlan` et `requireAccess` restent **inchangés** : la requête
  `status in [active,trialing]` couvre automatiquement l'union Stripe + Play.
- `isPlus` devient « abonné actif sur **au moins un** canal » sans toucher au front
  ni à `access.ts`. C'est le pivot « ne rien casser ».

### 1.1 Forme du document (étendue, rétro-compatible)

`SubscriptionDocFields` (dans `stripeHelpers.ts`) gagne un champ optionnel, partagé
par les deux canaux :

```ts
channel: "stripe" | "play";   // absence => "stripe" (rétro-compat des docs existants)
```

Doc Play écrit sous `customers/{uid}/subscriptions/{purchaseToken}` :

| Champ | Source Play | Note |
| --- | --- | --- |
| `status` | mappé depuis l'état d'abonnement Play | voir §5.1 |
| `channel` | `"play"` | discriminant |
| `price` | `productId` (base plan / offer) | équivalent du `price_…` Stripe |
| `cancelAtPeriodEnd` | `autoRenewing === false` | |
| `currentPeriodEnd` | `expiryTime` | Date |
| `created` | `startTime` | Date |
| `updated` | `serverTimestamp()` | comme Stripe |

Le doc ID est le **`purchaseToken`** (stable pour une lignée d'abonnement Play),
comme le doc Stripe est indexé par `subId`.

## 2. Composants à livrer (miroir de l'architecture Stripe)

| Élément | Type | Rôle | Analogue Stripe |
| --- | --- | --- | --- |
| Plugin billing (natif) | Capacitor | lancer l'achat, lire les achats existants | (redirection web) |
| `verifyPlayPurchase` | callable | vérifie un reçu à l'achat, acquitte, écrit le doc | `createStripeCheckout` (+ webhook) |
| `playRtdnWebhook` | HTTP / Pub/Sub | renouvellements, résiliations, remboursements, holds | `stripeWebhook` |
| `playHelpers.ts` | lib pure | mapping état Play → doc, parse RTDN, résolution uid | `stripeHelpers.ts` |
| `playBilling.ts` (front) | lib | orchestre achat natif + appel `verifyPlayPurchase` | `subscription.ts` |
| Routage « Gérer » par canal | front | Play → deep link Store ; Stripe → portail | `openBillingPortal` |

## 3. Plateforme Google (prérequis hors code)

1. **Compte Google Play Console** + fiche app publiée (au moins en test interne)
   sous l'`appId` `studio.cardamome`.
2. **Produit d'abonnement** `cardamome_plus` avec deux **base plans** :
   `monthly` (3,99 €) et `yearly` (29,99 €), en **parité** avec les tarifs Stripe.
   Noter les `productId` / base plan IDs (équivalents des `price_…`).
3. **Google Play Developer API** activée sur le projet GCP, + **liaison**
   Play Console ↔ projet GCP.
4. **Accès serveur sans clé de fichier (recommandé)** : accorder au **service
   account des Cloud Functions** (déjà sur GCP) le rôle de lecture financière /
   gestion des commandes dans Play Console. On évite ainsi de stocker un JSON de
   clé en secret. Repli si nécessaire : clé de service en secret Firebase
   (`PLAY_SERVICE_ACCOUNT_JSON`), même schéma que `STRIPE_SECRET_KEY`.
5. **RTDN** : créer un **topic Pub/Sub**, le renseigner dans Play Console
   (Monetization setup → Real-time developer notifications), et créer un abonnement
   **push** vers `playRtdnWebhook` avec le secret partagé en query
   (`?token=<PLAY_RTDN_SECRET>`).
6. **Secret** : `firebase functions:secrets:set PLAY_RTDN_SECRET` (chaîne
   aléatoire, comparée par `playRtdnWebhook` ; pendant de la signature Stripe).
7. **Produit d'abonnement** `cardamome_plus` créé dans Play Console (allow-list
   serveur `PLUS_PRODUCT_IDS`), base plans `monthly` / `yearly`.

## 4. Flux d'achat natif (Android uniquement)

Le CTA « Passer à Cardamome+ » **bifurque selon le contexte** (déjà centralisé
dans `runtimeContext.ts`) :

- `browser` / `pwa` : **inchangé** → Stripe Checkout (`startCheckout`).
- `capacitor-android` : **Play Billing natif**.

Séquence Android :

1. Le front lance l'achat via le plugin, en passant **`obfuscatedAccountId = uid`**
   (Firebase uid) sur la requête d'achat. C'est l'équivalent de la métadonnée
   Stripe `firebaseUID` : il revient dans la réponse de vérification et dans la
   plupart des flux, ce qui permet de retrouver l'uid.
2. Play renvoie `{ purchaseToken, productId }` (achat en attente d'acquittement).
3. Le front appelle la callable **`verifyPlayPurchase({ purchaseToken, productId,
   packageName })`** (l'uid vient du token d'auth, **jamais** du client).
4. Le serveur (§5) vérifie, **acquitte**, écrit le doc, et **enregistre le mapping**
   `playPurchases/{purchaseToken} → { uid, productId }` (indispensable pour résoudre
   les RTDN, qui ne portent pas l'uid).
5. Le front écoute déjà `customers/{uid}/subscriptions` → `isPlus` bascule seul.

> **Acquittement obligatoire** : un achat Play non acquitté sous **3 jours** est
> **remboursé automatiquement**. L'acquittement se fait côté serveur après
> vérification (une seule autorité), pas côté client.

## 5. Vérification serveur (`verifyPlayPurchase`)

Miroir durci de `createStripeCheckout`, avec les gardes maison déjà éprouvées :

1. `request.auth` requis (sinon `unauthenticated`), `uid = request.auth.uid`.
2. Valider `productId` contre une **allow-list serveur** des produits Cardamome+
   (bloque un `productId` forgé), comme Stripe valide `price.active && recurring`.
3. Appeler la **Play Developer API** `purchases.subscriptionsv2.get` (ou
   `purchases.subscriptions.get`) avec `packageName` + `purchaseToken`.
4. **Contrôle anti-usurpation** : `obfuscatedExternalAccountId` renvoyé par l'API
   doit correspondre à l'uid. Attention : le plugin (cf. §14) passe l'uid via
   `applicationUsername` + `obfuscator: 'uuid'`, qui le **hashe en UUIDv3**. Le
   serveur compare donc `uuidv3(uid, NS)` (déterministe), **pas** l'uid brut. S'il
   diffère (ou est absent sur un flux ancien), refuser / journaliser (empêche de
   « réclamer » l'achat d'un autre compte). Le résolveur robuste des RTDN reste le
   mapping `playPurchases/{purchaseToken}` écrit ici, où l'on tient l'uid du token
   d'auth ; l'`obfuscatedAccountId` n'est qu'une garde secondaire.
5. **Garde anti-double-abonnement inter-canal** (miroir de la garde Stripe) : si un
   abonnement **Stripe** actif existe déjà pour l'uid, refuser proprement et
   renvoyer vers la gestion (évite le double prélèvement). Idem dans l'autre sens
   côté Stripe.
6. **Acquitter** l'achat s'il ne l'est pas.
7. Écrire `customers/{uid}/subscriptions/{purchaseToken}` (via `subscriptionDocFields`
   version Play) + le mapping `playPurchases/{purchaseToken}`.

### 5.1 Mapping des états Play → `status`

`playHelpers.ts` (pur, testé) traduit l'état Play en `status` de la forme partagée
(`ACTIVE_STATUSES = ["active","trialing"]` reste la clé d'accès) :

| État Play | `status` écrit | Accès `isPlus` |
| --- | --- | --- |
| Actif, `autoRenewing` | `active` | oui |
| Période d'essai / intro | `trialing` | oui |
| **Grace period** (paiement en retard, accès maintenu) | `active` | oui |
| **Account hold** (suspendu) | `past_due` | non |
| Résilié mais encore dans la période payée | `active` + `cancelAtPeriodEnd` | oui jusqu'à `expiryTime` |
| Expiré / révoqué / remboursé | `canceled` (ou expiré) | non |

Le point clé : **grace period = accès maintenu**, **account hold = accès coupé**.
Ces deux états n'existent pas côté Stripe et sont la principale source de bugs si
mal mappés : ils sont couverts par des tests unitaires dédiés.

## 6. RTDN : le pendant du webhook Stripe (`playRtdnWebhook`)

Play envoie une **Real-time Developer Notification** à chaque événement de cycle de
vie (renouvellement, résiliation, remboursement, entrée/sortie de grace period ou
de hold, changement d'offre) sur le topic Pub/Sub.

1. Réception (push HTTP authentifié Pub/Sub, ou fonction déclenchée Pub/Sub).
2. Le message porte `{ purchaseToken, subscriptionId, notificationType }` mais
   **pas l'uid** → on le résout via `playPurchases/{purchaseToken}`.
3. **Re-vérifier** l'état auprès de la Play Developer API (ne jamais faire confiance
   au seul type de notification), puis **réécrire** le doc d'abonnement (même
   `syncSubscription` conceptuel que Stripe).
4. Remboursement / révocation → passer `status` hors des `ACTIVE_STATUSES`
   (`isPlus` retombe seul, front + serveur).

> Comme le webhook Stripe vérifie la **signature** avant de traiter, le webhook RTDN
> **authentifie** le push Pub/Sub (jeton OIDC du compte de service Pub/Sub) et ne
> traite jamais un corps non authentifié.

## 7. Gestion de l'abonnement (« Gérer mon abonnement »)

Le bouton actuel appelle `openBillingPortal` (portail Stripe). Il devient
**dépendant du canal** du doc actif (`channel`) :

- `channel === "stripe"` : portail Stripe (inchangé).
- `channel === "play"` : **deep link** vers la gestion Play
  `https://play.google.com/store/account/subscriptions?sku={productId}&package=studio.cardamome`
  (résiliation / changement d'offre se font dans le Play Store, pas chez nous).

## 8. Restauration des achats (réinstallation)

Au lancement en contexte `capacitor-android`, interroger le plugin pour les achats
**déjà possédés** ; pour tout achat actif non reflété dans Firestore, rejouer
`verifyPlayPurchase`. Couvre la réinstallation et le changement d'appareil sans
re-paiement.

## 9. Règles Firestore (`firestore.rules`)

- `customers/{uid}/subscriptions/{subId}` : **inchangé** (`read` = propriétaire,
  `write: if false`). Play écrit via l'Admin SDK, comme Stripe.
- **Nouveau** `playPurchases/{purchaseToken}` : mapping technique serveur-only →
  `allow read, write: if false` (jamais exposé au client, ne contient qu'`uid` +
  `productId`).

## 10. Tests (Vitest, obligatoires, cf. CLAUDE.md §4)

Toute la logique **pure** vit dans `functions/src/subscriptions/playHelpers.ts` et
est testée sans réseau ni credentials (miroir de `stripeHelpers.test.ts`) :

- Mapping état Play → `SubscriptionDocFields` (tous les cas du tableau §5.1).
- Cas limites : grace period (accès **maintenu**), account hold (accès **coupé**),
  résilié-mais-encore-payé, remboursé, `expiryTime` nul/passé.
- Parse d'une enveloppe RTDN (types de notification → action attendue), payload
  malformé / champ manquant → rejet propre (jamais de crash, jamais d'accès accordé
  par défaut).
- Résolution uid : `obfuscatedExternalAccountId` présent / absent / divergent.
- Allow-list `productId` : produit inconnu rejeté.

La glue I/O (`verifyPlayPurchase`, `playRtdnWebhook`) reste fine et délègue tout le
calcul aux helpers purs.

## 11. Ce qui ne bouge pas (garanties « ne rien casser »)

- **Chemin de lecture `isPlus` inchangé** : même collection, même requête. `front`
  (`subscribeToPlan`, `useSubscription`) et `access.ts` (`requireAccess`) **ne sont
  pas modifiés**.
- **Stripe intact** : Play est purement **additif**. Aucun retrait de fonction, de
  secret ni de route Stripe.
- **Bifurcation par contexte** : seul `capacitor-android` change de CTA ; `browser`
  et `pwa` continuent sur Stripe. La détection existe déjà (`runtimeContext.ts`).
- **Dégradé propre** : si Play n'est pas configuré (produits/creds absents), le CTA
  Android informe sans planter, comme le fait déjà `paymentReady` côté Stripe.

## 12. Découpage en jalons (livraison incrémentale)

- **J0. Spike plugin : TRANCHÉ (cf. §14).** Plugin retenu :
  `capacitor-plugin-cdv-purchase` (cdvpurchase v13.15+), validation par **notre**
  Cloud Function. Reste à faire côté J0 : le **PoC** (achat en piste de test interne
  renvoyant un `purchaseToken`), qui exige un build natif Android réel.
- **J1. Serveur, sans UI : FAIT (code).** Livré : `playHelpers.ts` (pur) + tests
  exhaustifs, `verifyPlayPurchase` + `playRtdnWebhook` (`play.ts`), champ `channel`
  partagé (`stripeHelpers.ts` + garde inter-canal dans `stripe.ts`), règle Firestore
  `playPurchases`, export `index.ts`, dépendance `google-auth-library` (ADC sans clé).
  `tsc` + `npm test` (679) + lint verts. Aucun caller côté app : inerte tant que J2
  n'est pas là. Reste hors-code (déploiement) : SA habilité en Play Console, topic +
  abonnement push RTDN, secret `PLAY_RTDN_SECRET`, produit `cardamome_plus`.
- **J2. Achat natif** : plugin intégré, CTA bifurqué sur `capacitor-android`,
  `playBilling.ts` (achat → `verifyPlayPurchase`). Test en piste interne Play.
- **J3. Cycle de vie complet** : routage « Gérer » par canal, restauration des
  achats au lancement, gardes anti-double-abonnement inter-canal.
- **J4. Recette + prod** : validation piste de test (testeurs licence, renouvellements
  accélérés), checklist MEP complète (§6 CLAUDE.md), déploiement fonctions
  (`cd functions && npm run deploy`, **actif seulement après déploiement manuel**).

## 13. Décisions actées (tranchées avant J0)

1. **Rétro-remplissage `channel` : NON.** La lecture (`status in [active,trialing]`)
   ignore `channel`, donc les docs Stripe existants (sans le champ) fonctionnent tels
   quels. Un helper pur `channelOf(doc)` retourne `"stripe"` par défaut quand le champ
   est absent ; on ajoute `channel: "stripe"` aux **nouvelles** écritures de
   `stripe.ts`. Aucune migration des docs en cours.
2. **iOS : différé, forme prête.** On ne construit rien pour iOS (la coquille ne cible
   qu'Android). Le champ `channel` accepte déjà `"appstore"` : StoreKit se greffera sur
   le même patron le jour venu, sans toucher au chemin de lecture.
3. **Inter-canal : bloquer + message.** Miroir exact de la garde anti-double-abonnement
   Stripe : si un abonnement actif existe déjà sur un autre canal, `verifyPlayPurchase`
   (et symétriquement le checkout Stripe) refuse proprement et renvoie vers « Gérer mon
   abonnement ». Pas de double prélèvement, pas de parcours de migration à ce stade.
4. **Créds serveur : service account des Functions, sans clé fichier.** On habilite le
   service account des Cloud Functions (déjà sur GCP) directement dans Play Console, via
   les droits admin. **Aucun** secret JSON à stocker. Repli documenté mais non retenu :
   clé JSON en secret Firebase si la liaison IAM s'avérait impossible.

## 14. Jalon 0 : décision plugin (livrable de spike)

**Plugin retenu : `capacitor-plugin-cdv-purchase`** (cdvpurchase, la famille
`cordova-plugin-purchase` de j3k0/Fovea, v13.15+).

Pourquoi lui plutôt que les alternatives :

| Critère | cdvpurchase (retenu) | Capawesome Purchases | Cap-go native-purchases | RevenueCat |
| --- | --- | --- | --- | --- |
| Bridge Capacitor natif (sans Cordova) | oui (v13.15+) | oui | oui | oui |
| Play Billing Library | 8.3 | 8.0 | 7.x | via SDK |
| Validation par **notre** serveur | oui (`store.validator` = URL/fn) | oui (expose le token) | oui | non (backend RevenueCat) |
| Dépendance tierce payante | non (MIT) | sponsorware (certains plugins) | non | oui (% du CA) |
| Maturité / base installée | très élevée | moyenne | moyenne | élevée |
| Cycle de vie complet (sub, restore, ack) | oui | oui | partiel | oui |

- **RevenueCat écarté** : backend tiers + commission sur le CA, à rebours du choix
  « maison » fait pour Stripe (décision §11 de la démarche).
- **Plugin maison écarté** : cdvpurchase couvre déjà tout le cycle de vie (achat,
  acquittement via `finish()`, restauration, abonnements, changements d'offre) avec
  validation serveur maison ; le réécrire serait de la dette nette.

Points de branchement confirmés (côté `playBilling.ts`, J2) :

- **Validation maison** : `store.validator = "<URL de verifyPlayPurchase>"` (ou une
  fonction qui appelle la callable). On n'utilise **pas** le service hébergé payant
  iaptic/Fovea. Le validateur répond OK/KO ; sur OK, cdvpurchase appelle `finish()`
  qui **acquitte** l'achat côté Play (couvre la règle des 3 jours, §4).
- **Liaison uid** : `store.applicationUsername = uid` + `store.obfuscator = 'uuid'`
  → `obfuscatedAccountId` valide (UUIDv3 déterministe). Contrôle serveur : comparer
  `uuidv3(uid)` (cf. §5 étape 4).
- **Restauration** : `store.restorePurchases()` au lancement en contexte
  `capacitor-android` (couvre §8).
- **Licence** : MIT, gratuit ; aucune part de CA.

**Reste du J0 (hands-on, hors de ce doc) :** PoC d'achat en **piste de test interne**
Play (compte testeur licence) renvoyant un `purchaseToken`, pour valider le bridge
avant d'écrire le serveur (J1). Nécessite un build natif Android réel
(`npm run cap:sync` + Android Studio), donc à faire côté machine de dev.
