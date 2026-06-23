// ─── TABS ─────────────────────────────────────────────────────────────────────
export const TABS = [
  { id: "home", label: "Recettes", icon: "book", path: "/recipes" },
  { id: "meal-plan", label: "Planning", icon: "calendar", path: "/meal-plan" },
  { id: "shopping", label: "Courses", icon: "shopping", path: "/shopping-lists" },
  { id: "fridge", label: "Stock", icon: "box", path: "/fridge" },
  { id: "config", label: "Config", icon: "settings", path: "/config" },
];
export const TAB_BY_PATH = Object.fromEntries(TABS.map(t => [t.path, t.id]));
export const TAB_BY_ID = Object.fromEntries(TABS.map(t => [t.id, t.path]));

// Config sub-sections URL mapping
export const CONFIG_SECTION_BY_PATH = {
  "ingredients": "ingredients",
  "ustensils": "ustensiles",
  "collections": "collections",
  "data": "données",
  "changelog": "nouveautés",
};
export const CONFIG_PATH_BY_SECTION = Object.fromEntries(
  Object.entries(CONFIG_SECTION_BY_PATH).map(([path, section]) => [section, path])
);
