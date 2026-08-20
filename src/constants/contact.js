// ─── CONTACT ──────────────────────────────────────────────────────────────────
// Adresse de contact publique de Cardamome, source unique côté UI (les documents
// légaux la portent aussi, en Markdown). Un seul endroit à changer si elle bouge.
export const CONTACT_EMAIL = "contact.cardamome@gmail.com";

// Sujet pré-rempli pour aider au tri des mails entrants.
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Cardamome : contact")}`;
