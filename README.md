<div align="center">

# Cardamome<span>·</span>

**Cuisinez mieux, organisez moins.**

Toutes vos recettes, votre planning repas et vos courses, au même endroit,
toujours avec vous.

<br />

![Version](https://img.shields.io/badge/version-4.12.1-6e9a3f?style=for-the-badge)
![License](https://img.shields.io/badge/licence-propri%C3%A9taire-8fba7a?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-installable-5b9cf6?style=for-the-badge)
![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?style=for-the-badge&logo=githubactions&logoColor=white)

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Cloud Functions](https://img.shields.io/badge/Cloud_Functions-Node_22-4285F4?style=flat-square&logo=googlecloud&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-7-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-4-6E9F18?style=flat-square&logo=vitest&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-10-4B32C3?style=flat-square&logo=eslint&logoColor=white)

</div>

---

## Sommaire

- [✨ Fonctionnalités](#-fonctionnalités)
- [🛠️ Stack technique](#️-stack-technique)
- [🚀 Démarrage](#-démarrage)
  - [Prérequis](#prérequis)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Lancer en développement](#lancer-en-développement)
- [📜 Scripts](#-scripts)
- [☁️ Déploiement](#️-déploiement)
- [🔖 Versionner](#-versionner)
- [🏗️ Architecture](#️-architecture)
- [📄 Licence](#-licence)

## ✨ Fonctionnalités

- 📖 **Recettes** : éditeur complet (ingrédients, ustensiles, étapes liées),
  recherche, filtres et tri (par défaut : les plus récentes d'abord). Chaque
  étape peut porter une photo et une astuce, reprises dans la fiche et le mode
  pas-à-pas. Les **ustensiles** sont rangés par famille, et les **appareils**
  (four, blender…) portent des réglages propres à chaque étape (température,
  mode, vitesse, durée) résumés sur leur pastille. Un tap sur une quantité en
  donne l'**équivalent en cuillères** (à soupe / à café) pour qui n'a pas de
  balance, et l'unité choisie peut remplacer la quantité d'origine dans toute la
  mise en place.
- 🧩 **Préparations de base** : une recette peut consommer une « base »
  réutilisable (sauce, pâte, appareil) avec un rendement ; les courses éclatent
  automatiquement la base en ingrédients bruts.
- 🤖 **Import intelligent** : importez une recette depuis une **URL** ou **1 à 2
  photos** d'un livre : extraction, structuration et liaison des ingrédients /
  ustensiles par Claude, qui **détecte aussi les préparations de base** (caramel,
  pâte, fond…) et leur rendement estimé (réservé aux abonnés **Cardamome+**, quotas
  jour/mois ; illimité pour l'administrateur).
- 📓 **Carnets** : rangez vos recettes dans des carnets colorés (manuels ou
  « intelligents », dérivés d'un filtre).
- 🌍 **Style de cuisine** : un champ unique parmi une liste prédéfinie
  (Française, Italienne, Marocaine, Japonaise…) qui sert aussi de filtre.
- 📝 **Journal d'itérations** : chaque modification de recette est versionnée
  avec un diff visuel, un commentaire et l'avatar de l'auteur.
- 🥗 **Nutri-Score & score santé** : calculés automatiquement à partir des
  ingrédients et de la base nutritionnelle (données Ciqual), avec difficulté
  estimée.
- 🌿 **Saisonnalité** : déduite des ingrédients ; badge « De saison » et filtre
  dédié.
- 📅 **Planning repas** : semainier glisser-déposer, menu contextuel par repas
  (ouvrir, replanifier vers une autre semaine, retirer), **générateur de semaine**
  (styles facile / équilibré / aventureux, repas composés, affinité de saison),
  **session batch** (préparations à cuisiner d'avance) et export `.ics`.
- 🛒 **Listes de courses** : ajout par collage, tri par rayon, gestes de swipe
  (→ j'achète, ← je supprime).
- 📦 **Stock** : inventaire présenté en **mur d'étagères**, chaque ingrédient
  un bocal en verre dont le niveau de remplissage dit l'état (en stock / bientôt
  vide / à racheter) ; les achats non périssables rejoignent automatiquement le
  stock, et la fiche recette signale ce que vous avez déjà.
- 🏡 **Foyer** : partage temps réel des recettes, du planning et des courses
  entre les membres d'un même foyer (invitation par e-mail).
- 🧭 **Découvrir & partager** : recettes publiées par la communauté, filtrables
  et clonables en un geste ; publication depuis vos propres recettes. Le partage
  d'une recette publique génère un lien à l'**aperçu riche** (photo + titre, rendu
  côté serveur pour WhatsApp / iMessage…), lisible même sans compte.
- 👨‍🍳 **Mode cuisine** : guidage pas-à-pas plein écran, mise en place cochable
  (regroupable par catégorie via un interrupteur, quantités affichables en
  cuillères à soupe ou à café au choix), photos et astuces d'étape incluses, et
  **minuteurs à notification native** (l'alerte sonne même écran verrouillé). Les
  gestes techniques repérés dans les étapes ouvrent un **glossaire enrichi**
  (définition, résultat attendu, erreurs fréquentes, à ne pas confondre).
- 🖨️ **Export** : impression PDF propre (texte sélectionnable, étapes non
  coupées, badges vegan / cuisine / difficulté) et JSON (import / export).
- 👤 **Profil** : nom d'affichage, heatmap d'activité cuisine façon GitHub, et
  zone de danger (purge ciblée, **suppression de compte** RGPD).
- 📜 **Informations légales** : mentions légales, confidentialité, CGU et
  cookies (Markdown), consultables même déconnecté.
- 🪧 **Vitrine publique** : la racine du site présente Cardamome avant toute
  connexion (manifeste, scènes vivantes en CSS, import intelligent, offre) en
  slides plein écran sur desktop et défilement naturel sur mobile, barre de
  navigation à ancres, thème clair / sombre. Elle se prolonge par un écran de
  connexion assorti (deux panneaux sur desktop, colonne épurée sur mobile,
  connexion Google en un geste).
- ☁️ **Synchro cloud** : persistance Firestore hors-ligne (IndexedDB), base de
  référence partagée synchronisée **en temps réel**, connexion Google.
- 🔒 **Anti-abus** : attestation d'origine (Firebase App Check) et règles
  Firestore durcies contre l'aspiration des données.
- 🌗 **Thème clair / sombre** et interface responsive mobile + desktop (PWA
  installable), avec onboarding illustré.
- 💳 **Cardamome+** : abonnement (mensuel ou annuel, paiement Stripe) qui débloque
  l'import intelligent, le générateur de semaine, la session batch, le foyer partagé, le
  détail du calcul Nutri-Score et les recettes illimitées (50 en plan gratuit).

## 🛠️ Stack technique

| Domaine | Technologie |
|---|---|
| UI | React 19, React Router 7 |
| Build | Vite 8 (Rolldown), `vite-plugin-pwa` |
| Backend | Firebase 12 (Auth, Firestore, Storage) |
| Serveur | Cloud Functions v2 (Node 22, `europe-west1`) |
| IA | Claude (Anthropic) pour l'import de recettes (vision + texte) |
| Tests | Vitest 4 (646 tests unitaires sur les libs et hooks critiques) |
| CI | GitHub Actions (test + build sur chaque push) |
| Qualité | ESLint 10 |

## 🚀 Démarrage

### Prérequis

- Node.js 22+ et npm
- Un projet [Firebase](https://console.firebase.google.com/) (Auth Google +
  Firestore + Storage activés ; Cloud Functions pour l'import IA)

### Installation

```shell
npm install
```

### Configuration

Créez un fichier `.env` à la racine avec vos clés Firebase :

```shell
# Firebase (obligatoire)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Contrôle d'accès (optionnel)
VITE_ALLOWED_EMAIL=...   # restreint la connexion à cet e-mail
VITE_ADMIN_EMAIL=...     # e-mail admin (édition de la base de référence, import IA)

# App Check / anti-scraping (optionnel : voir Déploiement)
VITE_FIREBASE_RECAPTCHA_SITE_KEY=...   # active App Check (reCAPTCHA v3) si renseignée
VITE_APPCHECK_DEBUG_TOKEN=...          # jeton de debug, en développement uniquement

# Cardamome+ / Stripe (optionnel : voir docs/stripe-mijote-plus.md)
VITE_STRIPE_PRICE_MONTHLY=...   # id du tarif mensuel (price_…)
VITE_STRIPE_PRICE_YEARLY=...    # id du tarif annuel (price_…)
```

> [!IMPORTANT]
> Sans les variables `VITE_FIREBASE_*`, Firebase ne s'initialise pas et la
> connexion échoue. Le fichier `.env` ne doit **jamais** être commité, il est
> ignoré par git.

> [!NOTE]
> `VITE_ALLOWED_EMAIL` verrouille l'application à une seule adresse Google.
> Laissez la variable vide pour autoriser n'importe quel compte Google.
> L'import IA (Cloud Functions) requiert en plus le secret serveur
> `ANTHROPIC_API_KEY` et le paramètre `ADMIN_EMAIL` (voir `functions/README.md`).
> Tant que `VITE_STRIPE_PRICE_*` est absent, le CTA « Passer à Cardamome+ »
> affiche « arrive bientôt » (voir `docs/stripe-mijote-plus.md` pour la mise
> en place complète, y compris les secrets `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`
> côté fonctions).

### Lancer en développement

```shell
npm run dev
```

L'application est disponible sur `http://localhost:5173`.

> [!TIP]
> Cardamome est une PWA : depuis le navigateur (mobile ou desktop), utilisez
> « Installer l'application » pour l'épingler comme une app native, avec un
> fonctionnement hors-ligne.

## 📜 Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (HMR) |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Prévisualise le build de production |
| `npm test` | Lance la suite de tests Vitest |
| `npm run lint` | Analyse statique ESLint |
| `npm run cap:sync` | Build web puis synchronise dans le projet natif Capacitor |
| `npm run cap:android` | Ouvre le projet Android dans Android Studio |

> Empaquetage mobile (Android via Capacitor, iOS à terme) : voir [`MOBILE.md`](MOBILE.md).

## ☁️ Déploiement

Le **front** est hébergé sur Vercel (déploiement à chaque push sur `main`).
Le **backend Firebase** se déploie via la CLI :

```shell
# Règles de sécurité + Cloud Functions
npx firebase deploy --only firestore:rules,storage:rules,functions
```

> [!NOTE]
> **App Check** : renseignez `VITE_FIREBASE_RECAPTCHA_SITE_KEY` et déployez le
> front *avant* d'activer le mode *Enforce* (console Firebase → App Check) sur
> Firestore / Functions / Storage, sinon vous bloqueriez vos propres requêtes.
> L'aperçu riche des liens partagés lit une recette publique **sans
> authentification** (côté serveur, pour les robots de prévisualisation) : garder
> Firestore en mode *monitor*, ou prévoir un endpoint dédié si vous passez en
> *Enforce*.

## 🔖 Versionner

Cardamome suit le [versionnage sémantique](https://semver.org/lang/fr/).
Utilisez `npm version` pour incrémenter la version et créer le tag git associé :

```shell
npm version major   # changement incompatible        (1.0.7 → 2.0.0)
npm version minor   # nouvelle fonctionnalité          (1.0.7 → 1.1.0)
npm version patch   # correction de bug                (1.0.7 → 1.0.8)
```

> [!NOTE]
> Le nom de code de version (ex. « Safran ») et l'historique affichés dans
> l'app sont dérivés automatiquement de [`CHANGELOG.md`](./CHANGELOG.md), une
> seule source de vérité à maintenir.

## 🏗️ Architecture

Le code est organisé en couches, du plus pur au plus visuel, les dépendances
ne vont jamais en sens inverse :

```
src/
├── App.jsx          # Shell : routing, état global, câblage
├── main.jsx         # Bootstrap React + enregistrement du service worker
├── context/         # Concerns transverses (AppShellContext)
├── hooks/           # Hooks réutilisables (useFirestoreSync, useHousehold, useLS…)
├── lib/             # Logique pure : domaine (Nutri-Score, planning, parsing,
│                    #   import/export, PDF) + infra Firebase
├── constants/       # Données figées (catégories, créneaux, changelog)
├── content/         # Contenu Markdown (documents légaux)
├── components/      # Composants de présentation réutilisables
├── pages/           # Écrans (Home, MealPlan, Shopping, Recipes, Profile…)
└── styles/          # global.css

api/                 # Fonctions serverless Vercel (aperçu Open Graph des liens partagés)
functions/           # Cloud Functions (import IA, paiement Stripe), extraction pure testée à part
data/                # Base d'ingrédients (YAML, source Ciqual)
scripts/             # Outils (seed de la base de référence)
```

La logique métier (calcul nutritionnel, rapprochement d'ingrédients, génération
du planning, import de recettes, PDF) vit dans `lib/` et `functions/`, découplée
de React et de tout I/O, donc testable en isolation.

## 📄 Licence

> [!WARNING]
> Logiciel **propriétaire** : tous droits réservés. Le code source, le design
> et les contenus associés ne peuvent être copiés, distribués ou modifiés sans
> autorisation écrite. Voir [`LICENSE`](./LICENSE).

---

<div align="center">
<sub>© 2026 Cardamome · Tous droits réservés</sub>
</div>
