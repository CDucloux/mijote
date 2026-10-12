import { describe, it, expect } from "vitest";
import { launchPath } from "@/lib/launcher/deepLink.js";
import { buildShortcuts, nextMeal } from "@/lib/launcher/shortcuts.js";
import { buildWidgetSnapshot, mealMeta, WIDGET_DAYS, WIDGET_ITEMS } from "@/lib/launcher/widgetSnapshot.js";
import { applyWidgetChecks, parseWidgetChecks } from "@/lib/launcher/widgetChecks.js";
import { firstHttpUrl } from "@/lib/launcher/clipboardLink.js";

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
      { slot: "Midi", color: "#e0a23e", title: "Salade de lentilles", meta: "", image: "", path: "/recipes/r2" },
      { slot: "Soir", color: "#c56b46", title: "Risotto aux cèpes", meta: "", image: "", path: "/recipes/r1" },
    ]);
  });
  it("liste les articles restants avec de quoi les cocher, et compte tout", () => {
    const items = ["Riz", "Beurre", "Cèpes"].map((name, i) => ({ id: String(i), name, checked: i === 1 }));
    const snap = buildWidgetSnapshot({ shoppingLists: [{ id: "l1", items }], date: at(10) });
    expect(snap.shopping.remaining).toBe(2);
    expect(snap.shopping.items.map(i => i.name)).toEqual(["Riz", "Cèpes"]);
    expect(snap.shopping.items[0]).toMatchObject({ key: "n:riz", refs: [{ listId: "l1", itemId: "0" }] });
  });
  it("plafonne la liste sans plafonner le compteur", () => {
    const items = Array.from({ length: WIDGET_ITEMS + 5 }, (_, i) => ({ id: String(i), name: `Article ${i}` }));
    const snap = buildWidgetSnapshot({ shoppingLists: [{ id: "l1", items }], date: at(10) });
    expect(snap.shopping.items).toHaveLength(WIDGET_ITEMS);
    expect(snap.shopping.remaining).toBe(WIDGET_ITEMS + 5);
  });
  it("regroupe un même article de deux listes sous une seule case", () => {
    const lists = [{ id: "a", items: [{ id: "x", name: "Riz" }] }, { id: "b", items: [{ id: "y", name: "riz" }] }];
    const [item] = buildWidgetSnapshot({ shoppingLists: lists, date: at(10) }).shopping.items;
    expect(item.refs).toEqual([{ listId: "a", itemId: "x" }, { listId: "b", itemId: "y" }]);
  });
  it("donne photo et durée du repas, sans photo inexploitable", () => {
    const rich = [{ id: "r1", name: "Risotto", image: "https://img.test/r.jpg", prepTime: 20, cookTime: 25 }, { id: "r2", name: "Salade", image: "data:image/png;base64,xx" }];
    const date = at(12);
    const snap = buildWidgetSnapshot({ mealPlan: { [keyOf(date)]: [{ recipeId: "r1", slot: "soir", portions: 4 }, { recipeId: "r2", slot: "midi" }] }, recipes: rich, date });
    expect(snap.days[0].meals.map(m => [m.image, m.meta])).toEqual([["", ""], ["https://img.test/r.jpg", "45m · 4 pers."]]);
  });
  it("reste valide sur un foyer vierge", () => {
    const snap = buildWidgetSnapshot({ date: at(10) });
    expect(snap.shopping).toEqual({ remaining: 0, items: [] });
    expect(snap.days.every(d => d.meals.length === 0)).toBe(true);
  });
});

describe("mealMeta", () => {
  it("additionne préparation et cuisson, et omet l'inconnu", () => {
    expect(mealMeta({ prepTime: 30, cookTime: 60 }, 2)).toBe("1h30 · 2 pers.");
    expect(mealMeta({ prepTime: 15 }, undefined)).toBe("15m");
    expect(mealMeta(undefined, 3)).toBe("3 pers.");
    expect(mealMeta({}, 0)).toBe("");
  });
});

describe("parseWidgetChecks", () => {
  it("garde les bascules valides", () => {
    const raw = { checks: [{ checked: true, refs: [{ listId: "l1", itemId: "i1" }] }] };
    expect(parseWidgetChecks(raw)).toEqual([{ checked: true, refs: [{ listId: "l1", itemId: "i1" }] }]);
  });
  it("écarte les entrées malformées sans faire échouer le lot", () => {
    const raw = { checks: [null, { checked: "oui", refs: [] }, { checked: false, refs: [{ listId: 1 }, { listId: "l", itemId: "i" }] }, { checked: true, refs: [] }] };
    expect(parseWidgetChecks(raw)).toEqual([{ checked: false, refs: [{ listId: "l", itemId: "i" }] }]);
  });
  it("tolère une charge utile absente ou étrangère", () => {
    expect(parseWidgetChecks(undefined)).toEqual([]);
    expect(parseWidgetChecks({ checks: "x" })).toEqual([]);
  });
});

describe("applyWidgetChecks", () => {
  const lists = [
    { id: "l1", items: [{ id: "a", name: "Riz" }, { id: "b", name: "Beurre", checked: true }] },
    { id: "l2", items: [{ id: "c", name: "Sel" }] },
  ];
  it("coche les articles visés et laisse les autres listes intactes", () => {
    const next = applyWidgetChecks(lists, [{ checked: true, refs: [{ listId: "l1", itemId: "a" }] }]);
    expect(next[0].items.map(i => !!i.checked)).toEqual([true, true]);
    expect(next[1]).toBe(lists[1]);
  });
  it("fait gagner la dernière bascule d'un même article", () => {
    const ref = { listId: "l1", itemId: "b" };
    const next = applyWidgetChecks(lists, [{ checked: true, refs: [ref] }, { checked: false, refs: [ref] }]);
    expect(next[0].items[1].checked).toBe(false);
  });
  it("rend les mêmes listes quand rien ne change (article supprimé, déjà coché)", () => {
    expect(applyWidgetChecks(lists, [{ checked: true, refs: [{ listId: "l1", itemId: "b" }, { listId: "zz", itemId: "a" }] }])).toBe(lists);
    expect(applyWidgetChecks(lists, [])).toBe(lists);
  });
});

describe("firstHttpUrl", () => {
  it("trouve le lien dans un texte partagé, sans la ponctuation qui le suit", () => {
    expect(firstHttpUrl("Regarde ça : https://www.marmiton.org/recettes/risotto.aspx !")).toBe("https://www.marmiton.org/recettes/risotto.aspx");
    expect(firstHttpUrl("(https://cuisine.fr/tarte).")).toBe("https://cuisine.fr/tarte");
  });
  it("garde un lien nu intact, requête comprise", () => {
    expect(firstHttpUrl("  https://youtu.be/abc?si=x1  ")).toBe("https://youtu.be/abc?si=x1");
  });
  it("ignore ce qui n'est pas un lien web", () => {
    expect(firstHttpUrl("200 g de farine")).toBeNull();
    expect(firstHttpUrl("ftp://exemple.com/a")).toBeNull();
    expect(firstHttpUrl("https://localhost")).toBeNull();
    expect(firstHttpUrl("")).toBeNull();
    expect(firstHttpUrl(null)).toBeNull();
    expect(firstHttpUrl(42)).toBeNull();
  });
});
