// ─── TABS ─────────────────────────────────────────────────────────────────────
// L'onglet « home » est la page d'atterrissage (dashboard + découverte). L'ancien
// onglet d'accueil (Mes Recettes) devient « recipes » et garde son path /recipes.
// La Configuration n'est plus un onglet : on y accède via le menu avatar.
export const TABS = [
  { id: "home", label: "Accueil", icon: "home", path: "/home" },
  { id: "recipes", label: "Recettes", icon: "book", path: "/recipes" },
  { id: "meal-plan", label: "Planning", icon: "calendar", path: "/meal-plan" },
  { id: "shopping", label: "Courses", icon: "shopping", path: "/shopping-lists" },
  { id: "stock", label: "Stock", icon: "box", path: "/stock" },
];
export const TAB_BY_PATH = Object.fromEntries(TABS.map(t => [t.path, t.id]));
export const TAB_BY_ID = Object.fromEntries(TABS.map(t => [t.id, t.path]));

/**
 * Déduit l'onglet actif d'un chemin d'URL. Les onglets ont un chemin exact
 * (`TAB_BY_PATH`) ; les autres écrans (fiche recette, admin, profil…) retombent
 * sur leur onglet parent par préfixe. Chemin vide / inconnu → `"home"`.
 *
 * @param {string | null | undefined} pathname - Chemin (`location.pathname`).
 * @returns {string} L'identifiant d'onglet (`home`, `recipes`, `meal-plan`, …).
 */
export function tabForPath(pathname) {
  if (!pathname) return "home";
  if (TAB_BY_PATH[pathname]) return TAB_BY_PATH[pathname];
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/legal")) return "legal";
  if (pathname.startsWith("/guide")) return "guide";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/recipes")) return "recipes";
  if (pathname.startsWith("/meal-plan")) return "meal-plan";
  return "home";
}

// Console admin : sous-sections mappées sur l'URL.
export const CONFIG_SECTION_BY_PATH = {
  "dashboard": "dashboard",
  "ingredients": "ingredients",
  "ustensils": "ustensiles",
  "techniques": "techniques",
  "sources": "sources",
  "moderation": "modération",
};
export const CONFIG_PATH_BY_SECTION = Object.fromEntries(
  Object.entries(CONFIG_SECTION_BY_PATH).map(([path, section]) => [section, path])
);
