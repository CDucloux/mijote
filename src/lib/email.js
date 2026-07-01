// ─── ENVOI D'E-MAIL (EmailJS, 100 % côté client) ─────────────────────────────
// Volontairement sans backend ni Cloud Function : on appelle l'API REST d'EmailJS
// avec la clé publique. Trois variables suffisent dans le .env (voir .env.example) :
//   VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, VITE_EMAILJS_PUBLIC_KEY
// Si l'une manque, l'envoi est simplement ignoré (l'invitation reste créée côté
// Firestore) — l'app fonctionne donc parfaitement sans configurer les e-mails.

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const emailConfigured = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

// Envoie l'e-mail d'invitation au foyer. Renvoie true si envoyé, false sinon
// (config absente, hors ligne ou erreur réseau) — jamais d'exception propagée.
export async function sendInviteEmail({ toEmail, foyerName, inviterName }) {
  if (!emailConfigured || !toEmail) return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  // Les clés `template_params` doivent correspondre aux variables du template
  // EmailJS ({{to_email}}, {{foyer}}, {{inviter}}, {{app_url}}).
  const payload = {
    service_id: SERVICE_ID,
    template_id: TEMPLATE_ID,
    user_id: PUBLIC_KEY,
    template_params: {
      to_email: toEmail,
      foyer: foyerName || "un foyer",
      inviter: inviterName || "Un membre de Mijoté",
      app_url: typeof window !== "undefined" ? window.location.origin : "",
    },
  };

  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
