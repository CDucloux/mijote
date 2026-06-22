/* Service worker dédié aux notifications push (Firebase Cloud Messaging).
   Volontairement séparé du service worker de cache (Workbox/VitePWA), enregistré
   sur un scope distinct (/firebase-push/) pour éviter tout conflit.
   La config Firebase (publique) est passée en query string à l'enregistrement. */
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.14.0/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);
firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

// Notification reçue alors que l'app est en arrière-plan / fermée.
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "Mijoté", {
    body: body || "",
    icon: icon || "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data || {},
  });
});

// Au clic : focus une fenêtre existante ou ouvre l'app (route éventuelle).
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if ("focus" in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
