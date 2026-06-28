#!/usr/bin/env node
// ─── SEED — pousse la couche de données YAML vers Firestore ───────────────────
// Lit data/*.yaml, valide avec la même lib que l'UI (src/lib/dataYaml.js), puis :
//   • écrit la Master DB    → master/ingredients · master/utensils · master/techniques
//   • publie les bases      → publicRecipes/* sous l'auteur officiel `mijote-official`
//
// Opération MANUELLE (comme le déploiement des règles Firestore). Nécessite un
// compte de service Firebase Admin — qui CONTOURNE les règles client, seul moyen
// d'écrire des docs publics sous un authorUid synthétique.
//
// Identifiants admin (au choix, du plus simple au plus explicite) :
//   • dépose `serviceAccount.json` à la racine du repo (gitignoré) → rien d'autre à faire
//   • ou mets GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_PROJECT_ID dans `.env.local`
//   • ou exporte-les dans le shell
//
//   npm run seed                  # défaut : techniques + bases (contenu canonique)
//   npm run seed -- --ingredients # pousse aussi l'échantillon ingredients.yaml
//   npm run seed -- --techniques  # un sous-ensemble (techniques|ingredients|utensils|bases)
//   npm run seed -- --dry-run     # valide et affiche, n'écrit rien (sans credentials)
//
// Merge NON destructif : chaque entrée est mise à jour (par id, sinon par nom) ou
// ajoutée — aucune entrée existante n'est jamais supprimée. `ingredients.yaml` et
// `utensils.yaml` sont des échantillons de format, hors du seed par défaut.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

import { parseTechniquesYaml, parseIngredientsYaml, parseUtensilsYaml } from "../src/lib/dataYaml.js";
import { validateRecipeSchema } from "../src/lib/recipeSchema.js";
import { buildPublishBundle } from "../src/lib/publicRecipes.js";
import { DEFAULT_CATEGORIES } from "../src/constants/categories.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const read = (f) => fs.readFileSync(path.join(DATA_DIR, f), "utf8");

// Charge les variables d'un fichier .env (sans écraser l'environnement déjà
// défini). Permet de mettre GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_PROJECT_ID
// dans un fichier non commité (.env.local / .env, déjà gitignorés) plutôt que de
// faire `export` à chaque fois.
function loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
[".env.local", ".env"].forEach(f => loadEnvFile(path.join(ROOT, f)));

// Auteur officiel des préparations de base (compte synthétique, sans connexion).
const MIJOTE_OFFICIAL = { uid: "mijote-official", displayName: "Mijoté × Escoffier", photoURL: "" };

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry-run");
const ONLY = new Set(argv.filter(a => !a.startsWith("--")).concat(
  ["techniques", "ingredients", "utensils", "bases"].filter(k => argv.includes("--" + k))
));
// Sans flag, on ne seede QUE le contenu canonique (glossaire + bases Escoffier).
// `ingredients.yaml` / `utensils.yaml` sont des ÉCHANTILLONS de format : on ne les
// pousse que si explicitement demandé (`--ingredients` / `--utensils`), pour ne
// jamais injecter de données d'exemple dans la vraie base master par accident.
const DEFAULT_KEYS = new Set(["techniques", "bases"]);
const wants = (k) => (ONLY.size ? ONLY.has(k) : DEFAULT_KEYS.has(k));

const log = (...a) => console.log(...a);
const fail = (msg) => { console.error("\n✗ " + msg); process.exit(1); };

// Merge non destructif d'items dans une liste existante (upsert par id puis nom).
const norm = (s) => String(s || "").trim().toLowerCase();
function upsert(existing, incoming) {
  const next = [...existing];
  const byId = new Map(next.map((d, i) => [d.id, i]));
  const byName = new Map(next.map((d, i) => [norm(d.name), i]));
  let created = 0, updated = 0;
  for (const row of incoming) {
    const idx = (row.id != null && byId.has(row.id)) ? byId.get(row.id)
      : byName.has(norm(row.name)) ? byName.get(norm(row.name)) : -1;
    if (idx >= 0) { next[idx] = { ...next[idx], ...row, id: next[idx].id }; updated++; }
    else { next.push(row); byId.set(row.id, next.length - 1); byName.set(norm(row.name), next.length - 1); created++; }
  }
  return { next, created, updated };
}

// ── 1. Lecture + validation (toujours, même en dry-run) ──────────────────────
const parsed = {};

if (wants("techniques")) {
  const { items, errors } = parseTechniquesYaml(read("techniques.yaml"));
  if (errors.length) fail(`techniques.yaml : ${errors.length} erreur(s)\n  - ` + errors.join("\n  - "));
  parsed.techniques = items;
  log(`✓ techniques.yaml      — ${items.length} techniques`);
}

if (wants("ingredients")) {
  const { items, errors } = parseIngredientsYaml(read("ingredients.yaml"), { validCategories: Object.keys(DEFAULT_CATEGORIES) });
  if (errors.length) fail(`ingredients.yaml : ${errors.length} erreur(s)\n  - ` + errors.join("\n  - "));
  parsed.ingredients = items;
  log(`✓ ingredients.yaml     — ${items.length} ingrédients`);
}

if (wants("utensils")) {
  const { items, errors } = parseUtensilsYaml(read("utensils.yaml"));
  if (errors.length) fail(`utensils.yaml : ${errors.length} erreur(s)\n  - ` + errors.join("\n  - "));
  parsed.utensils = items;
  log(`✓ utensils.yaml        — ${items.length} ustensiles`);
}

if (wants("bases")) {
  const bases = parseYaml(read("base-preparations.yaml"));
  if (!Array.isArray(bases)) fail("base-preparations.yaml : le document doit être une liste.");
  const errs = [];
  const seen = new Set();
  for (const b of bases) {
    const label = b?.name || "?";
    if (!b?.isComponent) errs.push(`« ${label} » : isComponent doit être true.`);
    if (!b?.yield || typeof b.yield.amount !== "number" || !b.yield.unit) errs.push(`« ${label} » : yield { amount, unit } requis.`);
    if (!b?.id) errs.push(`« ${label} » : id requis.`);
    else if (seen.has(b.id)) errs.push(`« ${label} » : id en double « ${b.id} ».`);
    seen.add(b?.id);
    errs.push(...validateRecipeSchema(b, `« ${label} »`));
  }
  if (errs.length) fail(`base-preparations.yaml : ${errs.length} erreur(s)\n  - ` + errs.join("\n  - "));
  parsed.bases = bases;
  log(`✓ base-preparations.yaml — ${bases.length} préparations de base`);
}

// Pré-construit les docs publics des bases (réutilise la logique de l'app).
const baseDocs = (parsed.bases || []).flatMap(b => buildPublishBundle(b, MIJOTE_OFFICIAL, {}).docs);

if (DRY) {
  log("\n— DRY RUN — rien n'est écrit.");
  if (parsed.bases) log(`  Bases → ${baseDocs.length} docs publics sous ${MIJOTE_OFFICIAL.uid} :`);
  for (const d of baseDocs) log(`    publicRecipes/${d.pubId}  (${d.name})`);
  log("\n✓ Validation OK.");
  process.exit(0);
}

// ── 2. Écriture Firestore (firebase-admin) ───────────────────────────────────
const { initializeApp, applicationDefault, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");

// Résout les identifiants admin, du plus explicite au plus implicite :
//   1. GOOGLE_APPLICATION_CREDENTIALS → chemin d'un fichier de clé
//   2. clé auto-détectée à la racine du repo (gitignorée) : serviceAccount.json,
//      secrets/serviceAccount.json, ou *-firebase-adminsdk-*.json
//   3. Application Default Credentials (gcloud auth application-default login)
function resolveCredential() {
  const fromFile = (p) => cert(JSON.parse(fs.readFileSync(p, "utf8")));
  const explicit = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (explicit) {
    if (!fs.existsSync(explicit)) fail(`GOOGLE_APPLICATION_CREDENTIALS : fichier introuvable « ${explicit} ».`);
    log(`  clé : ${explicit}`);
    return fromFile(explicit);
  }
  const candidates = [
    path.join(ROOT, "serviceAccount.json"),
    path.join(ROOT, "secrets", "serviceAccount.json"),
    ...fs.readdirSync(ROOT).filter(f => /-firebase-adminsdk-.*\.json$/.test(f)).map(f => path.join(ROOT, f)),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (found) { log(`  clé : ${path.relative(ROOT, found)} (auto-détectée)`); return fromFile(found); }
  log("  clé : Application Default Credentials");
  return applicationDefault();
}

let app;
try {
  app = initializeApp({
    credential: resolveCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  });
} catch (e) {
  fail(`Initialisation Firebase Admin impossible : ${e.message}\n`
    + `  Fournis une clé de compte de service, au choix :\n`
    + `   • dépose serviceAccount.json à la racine du repo (non commité), ou\n`
    + `   • GOOGLE_APPLICATION_CREDENTIALS=/chemin/cle.json (dans .env.local ou exporté).`);
}
const dbAdmin = getFirestore(app);

async function writeMaster(docName, items) {
  const ref = dbAdmin.doc(`master/${docName}`);
  const snap = await ref.get();
  const existing = snap.exists ? (snap.data().items || []) : [];
  const { next, created, updated } = upsert(existing, items);
  await ref.set({ items: next });
  log(`  master/${docName} ← ${created} ajout(s), ${updated} maj (total ${next.length})`);
}

// Les identifiants ne sont réellement vérifiés qu'au premier accès Firestore :
// on enveloppe les écritures pour transformer un échec d'auth/permission en
// message clair plutôt qu'une trace de pile.
try {
  if (parsed.techniques) await writeMaster("techniques", parsed.techniques);
  if (parsed.ingredients) await writeMaster("ingredients", parsed.ingredients);
  if (parsed.utensils) await writeMaster("utensils", parsed.utensils);

  if (baseDocs.length) {
    let batch = dbAdmin.batch();
    let n = 0;
    for (const d of baseDocs) {
      batch.set(dbAdmin.doc(`publicRecipes/${d.pubId}`), d);
      if (++n % 400 === 0) { await batch.commit(); batch = dbAdmin.batch(); }
    }
    await batch.commit();
    log(`  publicRecipes ← ${baseDocs.length} doc(s) publié(s) sous ${MIJOTE_OFFICIAL.uid}`);
  }
} catch (e) {
  const auth = /credential|authenticat|UNAUTHENTICATED|permission|PERMISSION_DENIED|default credentials|invalid_grant/i.test(e.message || "");
  fail(auth
    ? `Accès Firestore refusé : ${e.message}\n`
      + `  Vérifie la clé de compte de service (fichier valide, bon projet, rôle suffisant).\n`
      + `  Aide : dépose serviceAccount.json à la racine, ou renseigne GOOGLE_APPLICATION_CREDENTIALS dans .env.local.`
    : `Échec de l'écriture : ${e.message}`);
}

log("\n✓ Seed terminé.");
process.exit(0);
