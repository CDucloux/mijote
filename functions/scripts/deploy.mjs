// Déploiement des Cloud Functions avec un délai d'analyse élargi.
// Avant d'envoyer le code, la CLI Firebase charge lib/index.js en local pour
// lister les fonctions, et abandonne au bout de 10 s par défaut (« User code
// failed to load. Cannot determine backend specification »). À froid (premier
// déploiement de la session, node_modules pas encore en cache disque,
// antivirus qui scanne chaque fichier requis), charger firebase-functions,
// firebase-admin, stripe et google-auth-library dépasse ce délai, puis passe au
// second essai. FUNCTIONS_DISCOVERY_TIMEOUT (en secondes) le relève.
import { spawnSync } from "node:child_process";

// Une seule chaîne de commande : `shell` résout npx.cmd sous Windows.
const command = ["npx firebase deploy --only functions", ...process.argv.slice(2)].join(" ");
const { status } = spawnSync(command, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT ?? "60" },
});
process.exit(status ?? 1);
