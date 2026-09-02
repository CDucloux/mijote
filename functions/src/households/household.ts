// ─── FOYER : CRÉATION RÉSERVÉE À CARDAMOME+ (côté serveur) ──────────────────────
// Le foyer partagé est une fonctionnalité Cardamome+. Le document households/{hid}
// n'est donc PLUS créable par le client (cf. firestore.rules : `allow create: if
// false`) : seul cet appel, gardé par `assertPlusOrAdmin`, l'écrit via l'Admin SDK.
// Le client sème ensuite les données du foyer et pose son pointeur (écritures
// autorisées au membre). Source de vérité abonnement : customers/{uid}/subscriptions.
import { onCall, type CallableRequest } from "firebase-functions/v2/https";
import { defineString } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertPlusOrAdmin } from "../quota/access.js";
import { buildHouseholdDoc } from "./householdHelpers.js";

if (!getApps().length) initializeApp();
const dbAdmin = getFirestore();

const ADMIN_EMAIL = defineString("ADMIN_EMAIL");
const REGION = "europe-west1"; // même région que les autres fonctions

/** Données attendues du client à la création d'un foyer. */
interface CreateHouseholdData {
  name?: unknown;
}

/**
 * Crée un foyer pour l'appelant (propriétaire + unique membre) après avoir vérifié
 * qu'il est admin ou abonné Cardamome+ ACTIF. Renvoie l'identifiant du foyer, avec
 * lequel le client sème les données partagées puis pose son pointeur.
 *
 * @returns `{ id }` l'identifiant du foyer créé.
 * @throws HttpsError `unauthenticated` si non connecté, `permission-denied` si ni
 *   admin ni abonné actif.
 */
export const createHousehold = onCall(
  { region: REGION, timeoutSeconds: 30, memory: "256MiB" },
  async (request: CallableRequest<CreateHouseholdData>) => {
    await assertPlusOrAdmin(request, ADMIN_EMAIL.value());
    const uid = request.auth!.uid;
    const email = request.auth!.token && request.auth!.token.email;
    const ref = dbAdmin.collection("households").doc();
    await ref.set(buildHouseholdDoc(uid, email, request.data ? request.data.name : undefined));
    return { id: ref.id };
  }
);
