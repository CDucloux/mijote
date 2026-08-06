// ─── POINT D'ENTRÉE DES CLOUD FUNCTIONS MIJOTÉ ───────────────────────────────
// Fichier chargé par Firebase (cf. `main` du package.json → lib/index.js). Rôle
// UNIQUE : rassembler et ré-exporter les fonctions déployées. Aucune logique
// métier ici — chaque domaine vit dans son propre module.
//
//   • Import de recette (URL / photo) → recipeImport.ts
//   • Paiement Mijoté+ (Stripe maison) → stripe.ts

export { importRecipeFromUrl, importRecipeFromImages } from "./recipeImport.js";
export { createStripeCheckout, createStripePortal, stripeWebhook } from "./stripe.js";
