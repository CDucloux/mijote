// ─── POINT D'ENTRÉE DES CLOUD FUNCTIONS CARDAMOME ───────────────────────────────
// Fichier chargé par Firebase (cf. `main` du package.json → lib/index.js). Rôle
// UNIQUE : rassembler et ré-exporter les fonctions déployées. Aucune logique
// métier ici, chaque domaine vit dans son propre module.
//
//   • Import de recette (URL / photo) → imports/
//   • Paiement Cardamome+ (Stripe maison) → subscriptions/
//   • Quotas d'import IA → quota/ (utilisé par imports/)

export { importRecipeFromUrl, importRecipeFromImages } from "./imports/recipeImport.js";
export { createStripeCheckout, createStripePortal, stripeWebhook } from "./subscriptions/stripe.js";
