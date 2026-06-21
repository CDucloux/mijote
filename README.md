<div align="center">

# Mijoté<span>·</span>

**Cuisinez mieux, organisez moins.**

Toutes vos recettes, votre planning repas et vos courses — au même endroit,
toujours avec vous.

React 19 · Vite 8 · Firebase · PWA

</div>

---

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

# Contrôle d'accès (optionnel)
VITE_ALLOWED_EMAIL=...   # restreint la connexion à cet e-mail
VITE_ADMIN_EMAIL=...     # e-mail admin (édition de la base de référence partagée)
```

### Lancer en développement

```shell
npm run dev
```

L'application est disponible sur `http://localhost:5173`.

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

---

<div align="center">
<sub>© 2026 Mijoté · Tous droits réservés</sub>
</div>
