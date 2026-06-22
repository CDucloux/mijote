<div align="center">

# Mijoté<span>·</span>

**Cuisinez mieux, organisez moins.**

Toutes vos recettes, votre planning repas et vos courses — au même endroit,
toujours avec vous.

<br />

![Version](https://img.shields.io/badge/version-2.0.0-e8703a?style=for-the-badge)
![License](https://img.shields.io/badge/licence-propri%C3%A9taire-8fba7a?style=for-the-badge)
![PWA](https://img.shields.io/badge/PWA-installable-5b9cf6?style=for-the-badge)

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-12-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![React Router](https://img.shields.io/badge/React_Router-7-CA4245?style=flat-square&logo=reactrouter&logoColor=white)
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
- [🔖 Versionner](#-versionner)
- [🏗️ Architecture](#️-architecture)
- [📄 Licence](#-licence)

## ✨ Fonctionnalités

- 📖 **Recettes** — éditeur complet (ingrédients, ustensiles, étapes liées),
  recherche, tri, tags et collections.
- 🥗 **Nutri-Score & score santé** — calculé automatiquement à partir des
  ingrédients et de la base nutritionnelle (données Ciqual).
- 📅 **Planning repas** — semainier glisser-déposer, export `.ics` vers votre
  calendrier.
- 🛒 **Listes de courses** — ajout par collage, tri par rayon, et **partage
  temps réel** entre plusieurs membres.
- 🧊 **Frigo** — inventaire avec suivi de fraîcheur et suggestions de recettes.
- 👨‍🍳 **Mode cuisine** — guidage pas-à-pas plein écran.
- 🖨️ **Export** — PDF imprimable et JSON (import/export de recettes).
- ☁️ **Synchro cloud** — persistance Firestore hors-ligne (IndexedDB), connexion
  Google.
- 🌗 **Thème clair / sombre** et interface responsive mobile + desktop (PWA
  installable).

## 🛠️ Stack technique

| Domaine | Technologie |
|---|---|
| UI | React 19, React Router 7 |
| Build | Vite 8, `vite-plugin-pwa` |
| Backend | Firebase (Auth, Firestore, Storage) |
| Qualité | ESLint 10 |

## 🚀 Démarrage

### Prérequis

- Node.js 18+ et npm
- Un projet [Firebase](https://console.firebase.google.com/) (Auth Google +
  Firestore + Storage activés)

### Installation

```shell
npm install
```

### Configuration

Créez un fichier `.env` à la racine avec vos clés Firebase :

```shell
# Firebase
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# Notifications push (optionnel — voir Cloud Messaging)
VITE_FIREBASE_VAPID_KEY=...   # clé publique VAPID du projet (Web Push)

# Contrôle d'accès (optionnel)
VITE_ALLOWED_EMAIL=...   # restreint la connexion à cet e-mail
VITE_ADMIN_EMAIL=...     # e-mail admin (édition de la base de référence partagée)
```

> [!NOTE]
> Les notifications push utilisent Firebase Cloud Messaging. Récupérez la clé
> **VAPID** dans la console Firebase (_Paramètres du projet → Cloud Messaging →
> Certificats Web push_). Sans elle, le bouton « Activer les notifications »
> reste inactif. Sur iPhone, le push requiert iOS 16.4+ **et** l'app ajoutée à
> l'écran d'accueil.

> [!IMPORTANT]
> Sans ces variables, Firebase ne s'initialise pas et la connexion échoue.
> Le fichier `.env` ne doit **jamais** être commité — il est ignoré par git.

> [!NOTE]
> `VITE_ALLOWED_EMAIL` verrouille l'application à une seule adresse Google.
> Laissez la variable vide pour autoriser n'importe quel compte Google.

### Lancer en développement

```shell
npm run dev
```

L'application est disponible sur `http://localhost:5173`.

> [!TIP]
> Mijoté est une PWA : depuis le navigateur (mobile ou desktop), utilisez
> « Installer l'application » pour l'épingler comme une app native, avec un
> fonctionnement hors-ligne.

## 📜 Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement (HMR) |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Prévisualise le build de production |
| `npm run lint` | Analyse statique ESLint |

## 🔖 Versionner

Mijoté suit le [versionnage sémantique](https://semver.org/lang/fr/).
Utilisez `npm version` pour incrémenter la version et créer le tag git associé :

```shell
npm version major   # changement incompatible        (1.0.7 → 2.0.0)
npm version minor   # nouvelle fonctionnalité          (1.0.7 → 1.1.0)
npm version patch   # correction de bug                (1.0.7 → 1.0.8)
```

> [!NOTE]
> Le nom de code de version (ex. « Safran ») et l'historique affichés dans
> l'app sont dérivés automatiquement de [`CHANGELOG.md`](./CHANGELOG.md) — une
> seule source de vérité à maintenir.

## 🏗️ Architecture

Le code est organisé en couches, du plus pur au plus visuel — les dépendances
ne vont jamais en sens inverse :

```
src/
├── App.jsx          # Shell : routing, état global, câblage
├── main.jsx         # Bootstrap React + enregistrement du service worker
├── context/         # Concerns transverses (AppShellContext)
├── hooks/           # Hooks réutilisables (useFirestoreSync, useLS…)
├── lib/             # Logique pure : domaine (Nutri-Score, parsing,
│                    #   import/export) + infra Firebase
├── constants/       # Données figées (catégories, onglets, changelog)
├── components/      # Composants de présentation réutilisables
├── screens/         # Écrans (Home, MealPlan, Shopping, Fridge, Config…)
└── styles/          # global.css
```

La logique métier (calcul nutritionnel, rapprochement d'ingrédients, génération
PDF, import de recettes) vit dans `lib/` et est découplée de React, donc
testable en isolation.

## 📄 Licence

> [!WARNING]
> Logiciel **propriétaire** — tous droits réservés. Le code source, le design
> et les contenus associés ne peuvent être copiés, distribués ou modifiés sans
> autorisation écrite. Voir [`LICENSE`](./LICENSE).

---

<div align="center">
<sub>© 2026 Mijoté · Tous droits réservés</sub>
</div>
