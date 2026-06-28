# `data/` — couche de données versionnée

Source de vérité **lisible et configurable** de la base de référence de Mijoté.
On édite ces fichiers YAML, puis on les pousse vers Firestore.

| Fichier | Cible Firestore | Contenu |
|---|---|---|
| `techniques.yaml` | `master/techniques` | Glossaire des techniques culinaires |
| `ingredients.yaml` | `master/ingredients` | Base d'ingrédients (échantillon de format) |
| `utensils.yaml` | `master/utensils` | Base d'ustensiles (échantillon de format) |
| `base-preparations.yaml` | `publicRecipes/*` | Préparations de base publiées (compte `mijote-official`) |

Le format de chaque fichier est documenté en tête du fichier lui-même.

## Import / Export

- **Import = YAML** : dans l'app, `Configuration › (Ingrédients / Ustensiles / Techniques)`, l'admin colle ou dépose un fichier YAML. La validation est stricte : à la moindre erreur, **tout** l'import est annulé (jamais d'écrasement partiel).
- **Export = Markdown** : les boutons d'export produisent un tableau Markdown lisible (revue, partage, PDF). Le Markdown n'est pas réimporté — le YAML est la source canonique.

## Seed (script)

`scripts/seed.mjs` lit ces fichiers et écrit la Master DB + publie les
préparations de base. Comme le déploiement des règles Firestore, c'est une
opération **manuelle** qui nécessite des droits d'administration.

```bash
# Authentification : un compte de service Firebase Admin
export GOOGLE_APPLICATION_CREDENTIALS=/chemin/vers/serviceAccount.json
export FIREBASE_PROJECT_ID=mijote-xxxx     # facultatif si présent dans la clé

npm run seed                 # tout
npm run seed -- --techniques # un sous-ensemble (techniques, ingredients,
                             # utensils, bases)
npm run seed -- --dry-run    # valide et affiche sans écrire
```

Le service account n'est **jamais** committé (voir `.gitignore`).

> Les préparations de base sont publiées sous l'auteur officiel
> `mijote-official` (« Mijoté × Escoffier »). Ce `authorUid` synthétique ne
> correspond à aucun compte connecté : seul le SDK Admin (qui contourne les
> règles client) peut les écrire — d'où le script plutôt qu'un import depuis
> l'app.

## Sources & licence

Les préparations de base et une partie du glossaire s'inspirent de
**A. Escoffier, _Le Guide Culinaire_ (1903)**, dans le **domaine public**. Les
textes sont **adaptés** (reformulés, quantités ramenées à l'échelle
domestique), jamais recopiés tels quels.
