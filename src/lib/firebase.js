import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

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
  const msg = `Configuration Firebase incomplète — variables manquantes : ${_missing.join(", ")}. `
    + `Renseigne les VITE_FIREBASE_* correspondantes dans ton fichier .env.`;
  if (typeof document !== "undefined") {
    document.body.innerHTML = `<div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:32px;text-align:center;font-family:system-ui,sans-serif;background:#1a1714;color:#f2efe9"><div style="max-width:420px"><div style="font-size:38px">🔧</div><h1 style="font-family:Georgia,serif;font-size:20px">Configuration manquante</h1><p style="font-size:13px;opacity:.75;line-height:1.5">${msg}</p></div></div>`;
  }
  throw new Error(msg);
}

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const provider = new GoogleAuthProvider();
// Cache persistant (IndexedDB) : lectures hors-ligne + file d'écritures durable qui
// survit aux rechargements et se resynchronise automatiquement à la reconnexion.
// persistentMultipleTabManager gère plusieurs onglets ouverts. À appeler avant tout
// autre accès Firestore (c'est le cas ici, au chargement du module).
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(firebaseApp);
