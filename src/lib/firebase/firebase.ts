/**
 * Initialisation Firebase (app, App Check, Auth, Firestore, Storage, Functions).
 * Point d'entrée unique : garde d'environnement, persistance explicite et cache
 * hors-ligne configurés une seule fois au chargement du module.
 *
 * @module firebase
 */
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Garde d'environnement : sans ces variables, Firebase s'initialise avec
// `undefined` et échoue de façon opaque plus tard. On échoue tôt et clairement.
const _missing = Object.entries(firebaseConfig).filter(([, v]) => !v).map(([k]) => k);
if (_missing.length) {
  const msg = `Configuration Firebase incomplète – variables manquantes : ${_missing.join(", ")}. `
    + `Renseigne les VITE_FIREBASE_* correspondantes dans ton fichier .env.`;
  if (typeof document !== "undefined") {
    document.body.innerHTML = `<div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px;text-align:center;font-family:system-ui,sans-serif;background:#1a1714;color:#f2efe9"><div style="max-width:420px"><div style="font-size:38px">🔧</div><h1 style="font-family:Georgia,serif;font-size:20px">Configuration manquante</h1><p style="font-size:13px;opacity:.75;line-height:1.5">${msg}</p></div></div>`;
  }
  throw new Error(msg);
}

export const firebaseApp = initializeApp(firebaseConfig);

// App Check (anti-abus / anti-scraping) : atteste que les requêtes viennent bien
// de la vraie app avant que Firestore / Functions / Storage ne répondent. On
// l'initialise dès qu'une clé reCAPTCHA v3 est fournie ; sans clé (dev local non
// configuré), on saute l'init pour ne pas casser le démarrage. En dev, un jeton de
// debug (généré depuis la console App Check) permet de travailler en mode enforce.
// À activer côté serveur : Console Firebase → App Check → Enforce sur Firestore,
// Cloud Functions et Storage (voir aussi enforceAppCheck dans functions/index.js).
const _recaptchaKey = import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY;
if (_recaptchaKey) {
  const _debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (import.meta.env.DEV && _debugToken && typeof self !== "undefined") {
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = _debugToken;
  }
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(_recaptchaKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// Persistance d'auth EXPLICITE (IndexedDB en priorité, repli localStorage) : la
// session survit au démarrage à froid hors ligne d'une PWA installée. `getAuth`
// choisit une heuristique parfois plus faible → on force via `initializeAuth`.
// `popupRedirectResolver` conserve le fonctionnement de signInWithPopup/redirect.
export const auth = initializeAuth(firebaseApp, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const provider = new GoogleAuthProvider();
// `prompt: "select_account"` force Google à afficher le sélecteur de compte à
// CHAQUE connexion, au lieu de ré-authentifier silencieusement le dernier compte.
// Permet de basculer d'un compte Google à un autre sans purger les cookies.
provider.setCustomParameters({ prompt: "select_account" });
// Cache persistant (IndexedDB) : lectures hors-ligne + file d'écritures durable qui
// survit aux rechargements et se resynchronise automatiquement à la reconnexion.
// persistentMultipleTabManager gère plusieurs onglets ouverts. À appeler avant tout
// autre accès Firestore (c'est le cas ici, au chargement du module).
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(firebaseApp);
// Cloud Functions (région europe-west1, alignée sur index.js) : import URL.
export const functions = getFunctions(firebaseApp, "europe-west1");
