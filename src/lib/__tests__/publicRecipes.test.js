import { describe, it, expect } from "vitest";
import {
  publicId, collectComponentDeps, deriveDietTags, buildKeywords,
  toPublicRecipe, buildPublishBundle, clonePublicBundle, filterPublicRecipes,
} from "@/lib/household/publicRecipes.js";

const user = { uid: "u1", displayName: "Chef Test", photoURL: "p.jpg" };

const ingredientDB = [
  { id: "i_beef", name: "Bœuf", category: "meat" },
  { id: "i_milk", name: "Lait", category: "dairy" },
  { id: "i_tomato", name: "Tomate", category: "vegetable" },
  { id: "i_cod", name: "Cabillaud", category: "fish_seafood" },
  { id: "i_flour", name: "Farine", category: "grain" },
];

const sauce = {
  id: "c1", name: "Sauce tomate", isComponent: true, yield: { amount: 500, unit: "ml" },
  ingredients: [{ dbId: "i_tomato", name: "Tomate", amount: 400, unit: "g" }],
};
const dish = {
  id: "r1", name: "Pâtes à la tomate", cuisine: "Italienne", nutriLetter: "B", healthScore: 70,
  collections: ["col1"], versions: [{ x: 1 }],
  ingredients: [
    { dbId: "i_flour", name: "Pâtes", amount: 200, unit: "g" },
    { recipeId: "c1", name: "Sauce tomate", amount: 250, unit: "ml" },
  ],
};
const recipesById = new Map([[sauce.id, sauce], [dish.id, dish]]);

describe("publicId", () => {
  it("prefixes with the uid for uniqueness", () => {
    expect(publicId("u1", "r1")).toBe("u1__r1");
  });
});

describe("collectComponentDeps", () => {
  it("returns the components referenced by a recipe", () => {
    expect(collectComponentDeps(dish, recipesById).map(c => c.id)).toEqual(["c1"]);
  });
  it("returns [] for a recipe without components", () => {
    expect(collectComponentDeps(sauce, recipesById)).toEqual([]);
  });
});

describe("deriveDietTags", () => {
  it("tags a vegetable-only dish as vegan-compatible", () => {
    const veg = { ingredients: [{ dbId: "i_tomato" }] };
    expect(deriveDietTags(veg, ingredientDB, recipesById)).toEqual(
      expect.arrayContaining(["omnivore", "flexitarien", "pescatarien", "vegetarien", "vegan"])
    );
  });
  it("excludes vegan/vegetarien when dairy is present", () => {
    const dairy = { ingredients: [{ dbId: "i_milk" }] };
    const tags = deriveDietTags(dairy, ingredientDB, recipesById);
    expect(tags).toContain("vegetarien");
    expect(tags).not.toContain("vegan");
  });
  it("keeps only omnivore/flexitarien for a meat dish", () => {
    const meat = { ingredients: [{ dbId: "i_beef" }] };
    expect(deriveDietTags(meat, ingredientDB, recipesById)).toEqual(["omnivore", "flexitarien"]);
  });
  it("allows pescatarien (not vegetarien) for a fish dish", () => {
    const fish = { ingredients: [{ dbId: "i_cod" }] };
    const tags = deriveDietTags(fish, ingredientDB, recipesById);
    expect(tags).toContain("pescatarien");
    expect(tags).not.toContain("vegetarien");
  });
  it("looks through components (mono-level)", () => {
    // dish itself only has flour + a tomato-sauce component → no animal product.
    expect(deriveDietTags(dish, ingredientDB, recipesById)).toContain("vegan");
  });
});

describe("buildKeywords", () => {
  it("tokenizes name, cuisine, author and ingredients", () => {
    const kw = buildKeywords(dish, "Chef Test");
    expect(kw).toEqual(expect.arrayContaining(["pates", "tomate", "italienne", "chef", "test"]));
  });
});

describe("toPublicRecipe / buildPublishBundle", () => {
  it("denormalizes index fields and strips local-only data", () => {
    const pub = toPublicRecipe(dish, user, { ingredientDB, recipesById });
    expect(pub.pubId).toBe("u1__r1");
    expect(pub.authorName).toBe("Chef Test");
    expect(pub.cuisine).toBe("Italienne");
    expect(pub.componentRefs).toEqual(["c1"]);
    expect(pub.recipe.collections).toBeUndefined();
    expect(pub.recipe.versions).toBeUndefined();
  });
  it("bundles the recipe together with its components", () => {
    const { docs, components } = buildPublishBundle(dish, user, { ingredientDB, recipesById });
    expect(components.map(c => c.id)).toEqual(["c1"]);
    expect(docs.map(d => d.pubId)).toEqual(["u1__r1", "u1__c1"]);
  });
});

describe("clonePublicBundle", () => {
  const pubDish = toPublicRecipe(dish, user, { ingredientDB, recipesById });
  const pubSauce = toPublicRecipe(sauce, user, { ingredientDB, recipesById });

  it("clones the recipe and its component, remapping the recipeId reference", () => {
    const { added, alreadyOwned } = clonePublicBundle(pubDish, [pubSauce], { existingRecipes: [], now: 1000 });
    expect(alreadyOwned).toBe(false);
    expect(added).toHaveLength(2);
    const main = added.find(r => !r.isComponent);
    const comp = added.find(r => r.isComponent);
    const compLine = main.ingredients.find(l => l.recipeId);
    expect(compLine.recipeId).toBe(comp.id);          // rewired to the new local id
    expect(comp.id).not.toBe("c1");                    // remapped
    expect(main.clonedFrom.publicId).toBe("u1__r1");   // attribution
    expect(main.collections).toEqual([]);              // notebooks not inherited
  });

  it("reuses an already-cloned component instead of duplicating it", () => {
    const ownedSauce = { id: "localSauce", isComponent: true, clonedFrom: { publicId: "u1__c1" } };
    const { added } = clonePublicBundle(pubDish, [pubSauce], { existingRecipes: [ownedSauce], now: 2000 });
    expect(added).toHaveLength(1);                      // only the main recipe
    const main = added[0];
    expect(main.ingredients.find(l => l.recipeId).recipeId).toBe("localSauce");
  });

  it("is a no-op when the recipe is already owned", () => {
    const ownedMain = { id: "localDish", clonedFrom: { publicId: "u1__r1" } };
    const res = clonePublicBundle(pubDish, [pubSauce], { existingRecipes: [ownedMain] });
    expect(res).toEqual({ added: [], mainId: "localDish", alreadyOwned: true });
  });

  it("drops the orphan line when a referenced component is unavailable", () => {
    const { added } = clonePublicBundle(pubDish, [], { existingRecipes: [], now: 3000 });
    expect(added).toHaveLength(1);
    expect(added[0].ingredients.some(l => l.recipeId)).toBe(false);
    expect(added[0].ingredients).toHaveLength(1);       // only the flour line remains
  });
});

describe("filterPublicRecipes", () => {
  const list = [
    { pubId: "a", name: "Curry de bœuf", cuisine: "Indienne", nutriLetter: "C", dietTags: ["omnivore", "flexitarien"], authorUid: "u9", keywords: ["curry", "boeuf"], isComponent: false, recipe: {} },
    { pubId: "b", name: "Salade verte", cuisine: "Française", nutriLetter: "A", dietTags: ["omnivore", "flexitarien", "pescatarien", "vegetarien", "vegan"], authorUid: "u8", keywords: ["salade", "verte"], isComponent: false, recipe: {} },
    { pubId: "c", name: "Base", isComponent: true, recipe: {} },
  ];
  it("hides components", () => {
    expect(filterPublicRecipes(list).every(p => !p.isComponent)).toBe(true);
  });
  it("filters by text on keywords", () => {
    expect(filterPublicRecipes(list, { text: "salade" }).map(p => p.pubId)).toEqual(["b"]);
  });
  it("filters by cuisine and author", () => {
    expect(filterPublicRecipes(list, { cuisine: "Indienne" }).map(p => p.pubId)).toEqual(["a"]);
    expect(filterPublicRecipes(list, { authorUid: "u8" }).map(p => p.pubId)).toEqual(["b"]);
  });
  it("filters by diet (vegan keeps only vegan-compatible)", () => {
    expect(filterPublicRecipes(list, { diet: "vegan" }).map(p => p.pubId)).toEqual(["b"]);
  });
  it("filters by max Nutri-Score letter", () => {
    expect(filterPublicRecipes(list, { nutriMax: "B" }).map(p => p.pubId)).toEqual(["b"]);
  });
  it("applies the injected season predicate", () => {
    const onlyB = filterPublicRecipes(list, { seasonOnly: true }, { isInSeason: (r) => r === list[1].recipe });
    expect(onlyB.map(p => p.pubId)).toEqual(["b"]);
  });
});
