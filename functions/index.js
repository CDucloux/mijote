const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// Région européenne : functions + scheduler tournent au plus près des utilisateurs.
setGlobalOptions({ region: "europe-west1", maxInstances: 5 });

// ─── PING (smoke test de déploiement) ────────────────────────────────────────
// Valide que l'infra Cloud Functions + admin SDK + accès Firestore fonctionnent.
// Provisoire : sera retiré une fois les fonctions planifiées en place.
exports.ping = onRequest(async (req, res) => {
  const usersSnap = await admin.firestore().collection("users").count().get();
  const count = usersSnap.data().count;
  logger.info("ping ok", { users: count });
  res.json({ ok: true, users: count, ts: Date.now() });
});
