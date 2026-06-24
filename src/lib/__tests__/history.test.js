import { describe, it, expect } from "vitest";
import { snapshotOf, nextVersionLabel, addVersion, deleteVersion, diffSnapshots } from "../history.js";

const baseRecipe = () => ({
  name: "Test",
  ingredients: [{ name: "Farine", amount: 200, unit: "g" }, { name: "Sel", amount: 1, unit: "pincée" }],
  utensils: [{ name: "Saladier" }],
  steps: [{ description: "Mélanger" }, { description: "Cuire" }],
  prepTime: 10, cookTime: 20, servings: 4,
});

describe("snapshotOf", () => {
  it("captures the snapshot fields and deep-copies arrays", () => {
    const r = baseRecipe();
    const snap = snapshotOf(r);
    expect(snap.prepTime).toBe(10);
    expect(snap.ingredients).toEqual(r.ingredients);
    snap.ingredients[0].amount = 999;
    expect(r.ingredients[0].amount).toBe(200); // defensive copy
  });
  it("omits undefined fields (Firestore rejects undefined)", () => {
    const snap = snapshotOf({ prepTime: 5 }); // no ingredients, etc.
    expect(Object.prototype.hasOwnProperty.call(snap, "yield")).toBe(false);
  });
});

describe("nextVersionLabel", () => {
  it("starts at v1 and increments with history length", () => {
    expect(nextVersionLabel(undefined)).toBe("v1");
    expect(nextVersionLabel([])).toBe("v1");
    expect(nextVersionLabel([{}, {}])).toBe("v3");
  });
});

describe("addVersion / deleteVersion", () => {
  it("appends an entry with snapshot + metadata", () => {
    const r = baseRecipe();
    const next = addVersion(r, { rating: 8, notes: "bon" });
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toMatchObject({ label: "v1", rating: 8, notes: "bon" });
    expect(next.history[0].snapshot.prepTime).toBe(10);
    expect(r.history).toBeUndefined(); // original untouched
  });
  it("coerces a non-finite rating to null", () => {
    const next = addVersion(baseRecipe(), { rating: NaN, notes: "" });
    expect(next.history[0].rating).toBeNull();
  });
  it("removes an entry by id", () => {
    let r = addVersion(baseRecipe(), { rating: 5, notes: "" });
    const id = r.history[0].id;
    r = deleteVersion(r, id);
    expect(r.history).toHaveLength(0);
  });
});

describe("diffSnapshots", () => {
  it("reports no changes for identical snapshots", () => {
    const snap = snapshotOf(baseRecipe());
    const diff = diffSnapshots(snap, snap);
    expect(diff.hasChanges).toBe(false);
  });

  it("detects an added ingredient", () => {
    const base = snapshotOf(baseRecipe());
    const target = snapshotOf({ ...baseRecipe(), ingredients: [...baseRecipe().ingredients, { name: "Sucre", amount: 50, unit: "g" }] });
    const diff = diffSnapshots(base, target);
    expect(diff.hasChanges).toBe(true);
    const added = diff.ingredients.find(i => i.name === "Sucre");
    expect(added).toMatchObject({ type: "added", qty: "50 g" });
  });

  it("detects a removed ingredient", () => {
    const base = snapshotOf(baseRecipe());
    const target = snapshotOf({ ...baseRecipe(), ingredients: [baseRecipe().ingredients[0]] });
    const diff = diffSnapshots(base, target);
    expect(diff.ingredients.find(i => i.name === "Sel")).toMatchObject({ type: "removed" });
  });

  it("detects a changed quantity", () => {
    const base = snapshotOf(baseRecipe());
    const mutated = baseRecipe();
    mutated.ingredients[0].amount = 250;
    const diff = diffSnapshots(base, snapshotOf(mutated));
    const ch = diff.ingredients.find(i => i.name === "Farine");
    expect(ch).toMatchObject({ type: "changed", from: "200 g", to: "250 g" });
  });

  it("matches ingredients case/space-insensitively", () => {
    const base = snapshotOf(baseRecipe());
    const mutated = baseRecipe();
    mutated.ingredients[0].name = "  FARINE  ";
    const diff = diffSnapshots(base, snapshotOf(mutated));
    expect(diff.ingredients.find(i => i.type !== "same")).toBeUndefined();
  });

  it("detects added and removed utensils (no quantity)", () => {
    const base = snapshotOf(baseRecipe());
    const target = snapshotOf({ ...baseRecipe(), utensils: [{ name: "Fouet" }] });
    const diff = diffSnapshots(base, target);
    expect(diff.utensils.find(u => u.name === "Fouet")).toMatchObject({ type: "added" });
    expect(diff.utensils.find(u => u.name === "Saladier")).toMatchObject({ type: "removed" });
  });

  it("detects a changed step by position", () => {
    const base = snapshotOf(baseRecipe());
    const mutated = baseRecipe();
    mutated.steps[1].description = "Cuire 20 min";
    const diff = diffSnapshots(base, snapshotOf(mutated));
    const ch = diff.steps.find(s => s.type === "changed");
    expect(ch).toMatchObject({ index: 1, from: "Cuire", to: "Cuire 20 min" });
  });

  it("detects added/removed steps", () => {
    const base = snapshotOf(baseRecipe());
    const target = snapshotOf({ ...baseRecipe(), steps: [{ description: "Mélanger" }] });
    const diff = diffSnapshots(base, target);
    expect(diff.steps.find(s => s.type === "removed")).toMatchObject({ index: 1 });
  });

  it("detects scalar changes (time, servings)", () => {
    const base = snapshotOf(baseRecipe());
    const target = snapshotOf({ ...baseRecipe(), cookTime: 30, servings: 6 });
    const diff = diffSnapshots(base, target);
    const labels = diff.scalars.map(s => s.label);
    expect(labels).toContain("Cuisson");
    expect(labels).toContain("Portions");
    expect(diff.scalars.find(s => s.label === "Cuisson")).toMatchObject({ from: "20 min", to: "30 min" });
  });

  it("tolerates null/empty snapshots", () => {
    expect(diffSnapshots(null, null).hasChanges).toBe(false);
  });
});
