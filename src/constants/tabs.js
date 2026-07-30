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

// Config sub-sections URL mapping
export const CONFIG_SECTION_BY_PATH = {
  "preferences": "préférences",
  "ingredients": "ingredients",
  "ustensils": "ustensiles",
  "techniques": "techniques",
  "collections": "collections",
  "data": "données",
  "changelog": "nouveautés",
};
export const CONFIG_PATH_BY_SECTION = Object.fromEntries(
  Object.entries(CONFIG_SECTION_BY_PATH).map(([path, section]) => [section, path])
);
