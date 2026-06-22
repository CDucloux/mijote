import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { firebaseApp } from "./firebase.js";
import { savePushToken } from "./firestore.js";

// ─── PUSH NOTIFICATIONS (Firebase Cloud Messaging) ───────────────────────────
// Couche front : détection de support, activation (permission + token), écoute
// des messages au premier plan. L'envoi des notifications se fera côté backend
// (Cloud Function planifiée) à partir des tokens stockés en Firestore.

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Config Firebase (publique) passée au SW de messaging via query string.
const SW_CONFIG = new URLSearchParams({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
}).toString();

let messagingPromise = null;
function getMessagingInstance() {
  if (!messagingPromise) {
    messagingPromise = isSupported().then(ok => (ok ? getMessaging(firebaseApp) : null)).catch(() => null);
  }
  return messagingPromise;
}

// Le navigateur peut-il recevoir des push ? (faux sur iOS Safari non installé.)
export async function pushSupported() {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  return !!(await getMessagingInstance());
}

// État courant : "granted" | "denied" | "default" | "unsupported".
export async function notificationState() {
  if (!(await pushSupported())) return "unsupported";
  return Notification.permission;
}

// Demande la permission, enregistre le SW dédié, récupère et stocke le token.
// Retourne { ok, token } ou { ok:false, reason }.
export async function enablePushNotifications(uid) {
  const messaging = await getMessagingInstance();
  if (!messaging) return { ok: false, reason: "unsupported" };
  if (!VAPID_KEY) return { ok: false, reason: "no-vapid" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: permission };

  // SW de messaging enregistré sur un scope distinct du SW de cache (Workbox).
  const registration = await navigator.serviceWorker.register(
    `/firebase-messaging-sw.js?${SW_CONFIG}`,
    { scope: "/firebase-push/" }
  );

  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) return { ok: false, reason: "no-token" };

  if (uid) await savePushToken(uid, token);
  return { ok: true, token };
}

// Notifications reçues alors que l'app est au premier plan (sinon c'est le SW).
export async function listenForegroundMessages(handler) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => {};
  return onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    handler({ title: title || "Mijoté", body: body || "", data: payload.data || {} });
  });
}
