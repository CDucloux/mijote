import { describe, it, expect } from "vitest";
import { launchPath } from "@/lib/launcher/deepLink.js";
import { buildShortcuts, nextMeal } from "@/lib/launcher/shortcuts.js";
import { buildWidgetSnapshot, WIDGET_DAYS, WIDGET_ITEMS } from "@/lib/launcher/widgetSnapshot.js";

const recipes = [{ id: "r1", name: "Risotto aux cèpes" }, { id: "r2", name: "Salade de lentilles" }, { id: "r3", name: "Porridge" }];
// Midi UTC : la clé de jour (UTC) et l'heure locale restent sur la même journée.
const at = (hour) => { const d = new Date("2026-10-10T12:00:00Z"); d.setHours(hour, 0, 0, 0); return d; };
const keyOf = (d) => d.toISOString().slice(0, 10);

describe("launchPath", () => {
  it("rejoue le chemin d'un lien de lanceur", () => {
    expect(launchPath("cardamome://open/shopping-lists")).toBe("/shopping-lists");
    expect(launchPath("cardamome://open/recipes/abc_12?x=1#y")).toBe("/recipes/abc_12");
  });
  it("ouvre l'accueil sur un lien sans chemin", () => {
    expect(launchPath("cardamome://open")).toBe("/home");
  });
  it("refuse les liens étrangers ou forgés", () => {
    expect(launchPath(null)).toBeNull();
    expect(launchPath("")).toBeNull();
    expect(launchPath("https://evil.example/recipes")).toBeNull();
    expect(launchPath("cardamome://openx")).toBeNull();
    expect(launchPath("cardamome://open//evil.example")).toBeNull();
    expect(launchPath("cardamome://open/../secret")).toBeNull();
    expect(launchPath("cardamome://open/recipes/<script>")).toBeNull();
  });
});

describe("nextMeal", () => {
  it("prend le premier créneau d'aujourd'hui pas encore passé", () => {
    const date = at(13);
    const mealPlan = { [keyOf(date)]: [{ recipeId: "r1", slot: "soir" }, { recipeId: "r2", slot: "midi" }, { recipeId: "r3", slot: "matin" }] };
    const next = nextMeal({ mealPlan, recipes, date });
    expect(next.meal.recipeId).toBe("r2");
    expect(next.when).toBe("Ce midi");
  });
  it("bascule sur demain quand la journée est passée", () => {
    const date = at(16);
    const tomorrow = new Date(date.getTime() + 86400000);
    const mealPlan = { [keyOf(date)]: [{ recipeId: "r2", slot: "midi" }], [keyOf(tomorrow)]: [{ recipeId: "r1", slot: "soir" }] };
    expect(nextMeal({ mealPlan, recipes, date }).when).toBe("Demain soir");
  });
  it("ignore les recettes supprimées et renvoie null sans rien de prévu", () => {
    const date = at(9);
    expect(nextMeal({ mealPlan: { [keyOf(date)]: [{ recipeId: "gone", slot: "soir" }] }, recipes, date })).toBeNull();
    expect(nextMeal({ date })).toBeNull();
  });
});

describe("buildShortcuts", () => {
  it("met le prochain repas en tête et compte les courses", () => {
    const date = at(17);
    const mealPlan = { [keyOf(date)]: [{ recipeId: "r1", slot: "soir" }] };
    const shoppingLists = [{ id: "l1", items: [{ id: "a", name: "Riz" }, { id: "b", name: "Beurre", checked: true }, { id: "c", name: "Cèpes" }] }];
    const shortcuts = buildShortcuts({ mealPlan, recipes, shoppingLists, date });
    expect(shortcuts.map(s => s.id)).toEqual(["next-meal", "shopping", "import-photo", "meal-plan"]);
    expect(shortcuts[0]).toMatchObject({ longLabel: "Ce soir : Risotto aux cèpes", path: "/recipes/r1", icon: "meal" });
    expect(shortcuts[1].longLabel).toBe("Courses · 2 à acheter");
  });
  it("invite à planifier quand rien n'est prévu, liste vide comprise", () => {
    const shortcuts = buildShortcuts({ date: at(10) });
    expect(shortcuts.map(s => s.id)).toEqual(["plan-week", "shopping", "import-photo", "recipes"]);
    expect(shortcuts[1].longLabel).toBe("Liste de courses");
  });
  it("ne produit que des chemins acceptés au retour par launchPath", () => {
    const date = at(17);
    const shortcuts = buildShortcuts({ mealPlan: { [keyOf(date)]: [{ recipeId: "r1", slot: "soir" }] }, recipes, date });
    for (const s of shortcuts) expect(launchPath(`cardamome://open${s.path}`)).toBe(s.path);
  });
});

describe("buildWidgetSnapshot", () => {
  it("fournit les jours suivants d'avance, avec la couleur du créneau", () => {
    const date = at(20);
    const tomorrow = new Date(date.getTime() + 86400000);
    const snap = buildWidgetSnapshot({ mealPlan: { [keyOf(tomorrow)]: [{ recipeId: "r1", slot: "soir" }, { recipeId: "r2", slot: "midi" }] }, recipes, date });
    expect(snap.days).toHaveLength(WIDGET_DAYS);
    expect(snap.days[0]).toEqual({ key: keyOf(date), meals: [] });
    expect(snap.days[1].meals).toEqual([
      { slot: "Midi", color: "#e0a23e", title: "Salade de lentilles", path: "/recipes/r2" },
      { slot: "Soir", color: "#c56b46", title: "Risotto aux cèpes", path: "/recipes/r1" },
    ]);
  });
  it("liste au plus quelques articles restants mais compte tout", () => {
    const items = ["Riz", "Beurre", "Cèpes", "Parmesan", "Échalote", "Bouillon"].map((name, i) => ({ id: String(i), name, checked: i === 1 }));
    const snap = buildWidgetSnapshot({ shoppingLists: [{ id: "l1", items }], date: at(10) });
    expect(snap.shopping.remaining).toBe(5);
    expect(snap.shopping.items).toHaveLength(WIDGET_ITEMS);
    expect(snap.shopping.items.map(i => i.name)).not.toContain("Beurre");
  });
  it("reste valide sur un foyer vierge", () => {
    const snap = buildWidgetSnapshot({ date: at(10) });
    expect(snap.shopping).toEqual({ remaining: 0, items: [] });
    expect(snap.days.every(d => d.meals.length === 0)).toBe(true);
  });
});
