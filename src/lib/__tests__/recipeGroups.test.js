import { describe, it, expect } from "vitest";
import { groupBy, hasGroups, groupOrder, relabelGroup, moveWithinGroup, moveAcrossGroups, sectionRuns, moveWithAdopt, looseRunLabel } from "@/lib/recipes/recipeGroups.js";

describe("recipeGroups", () => {
  it("returns a single main section (group null) when nothing is grouped", () => {
    const items = [{ id: "a" }, { id: "b" }];
    const sections = groupBy(items);
    expect(sections).toHaveLength(1);
    expect(sections[0].group).toBeNull();
    expect(sections[0].items).toHaveLength(2);
  });

  it("puts named groups first (first-appearance order), ungrouped section last", () => {
    const items = [
      { id: "a", group: "Crème" },
      { id: "b" },
      { id: "c", group: "Pâte" },
      { id: "d", group: "Crème" },
    ];
    const sections = groupBy(items);
    expect(sections.map(s => s.group)).toEqual(["Crème", "Pâte", null]);
    expect(sections[0].items.map(i => i.id)).toEqual(["a", "d"]);
    expect(sections[2].items.map(i => i.id)).toEqual(["b"]);
  });

  it("treats blank/whitespace groups as ungrouped", () => {
    expect(hasGroups([{ group: "" }, { group: "   " }])).toBe(false);
    expect(hasGroups([{ group: "Pâte" }])).toBe(true);
    expect(groupBy([{ id: "a", group: "  " }])[0].group).toBeNull();
  });

  it("groupOrder scans ingredients then steps, de-duplicated", () => {
    const recipe = {
      ingredients: [{ group: "Pâte" }, { group: "Crème" }],
      steps: [{ group: "Crème" }, { group: "Montage" }],
    };
    expect(groupOrder(recipe)).toEqual(["Pâte", "Crème", "Montage"]);
  });

  it("relabelGroup renames matching lines and clears when target is empty", () => {
    const items = [{ id: "a", group: "Pâte" }, { id: "b", group: "Crème" }];
    expect(relabelGroup(items, "Pâte", "Base").map(i => i.group)).toEqual(["Base", "Crème"]);
    expect(relabelGroup(items, "Pâte", "").map(i => i.group)).toEqual(["", "Crème"]);
  });

  it("moveWithinGroup reorders only inside the section, leaving other items in place", () => {
    // Section "P" is scattered (indices 0, 2, 3) among a "C" item at index 1.
    const items = [
      { id: "p1", group: "P" },
      { id: "c1", group: "C" },
      { id: "p2", group: "P" },
      { id: "p3", group: "P" },
    ];
    // Move p1 (local 0) to local 2 within "P" → order p2, p3, p1 in their original slots.
    const out = moveWithinGroup(items, "P", 0, 2);
    expect(out.map(i => i.id)).toEqual(["p2", "c1", "p3", "p1"]);
    // "C" untouched, out-of-range is a no-op (returns a copy).
    expect(moveWithinGroup(items, "P", 0, 9).map(i => i.id)).toEqual(items.map(i => i.id));
  });

  it("moveAcrossGroups moves an item into another section, changing its group", () => {
    const items = [
      { id: "a", group: "Pâte" },
      { id: "b", group: "Pâte" },
      { id: "c", group: "Crème" },
    ];
    // Move b (local 1 of Pâte) to the start of Crème (local 0).
    const out = moveAcrossGroups(items, "Pâte", 1, "Crème", 0);
    const b = out.find(i => i.id === "b");
    expect(b.group).toBe("Crème");
    // Inserted before c.
    const order = out.filter(i => i.group === "Crème").map(i => i.id);
    expect(order).toEqual(["b", "c"]);
  });

  it("sectionRuns preserves array order and gives continuous global offsets", () => {
    const steps = [
      { id: "s0" },                       // ungrouped (preheat)
      { id: "s1", group: "Caramel" },
      { id: "s2", group: "Caramel" },
      { id: "s3", group: "Pâte" },
      { id: "s4" },                       // ungrouped (assembly)
    ];
    const runs = sectionRuns(steps);
    expect(runs.map(r => [r.group, r.start, r.items.length]))
      .toEqual([[null, 0, 1], ["Caramel", 1, 2], ["Pâte", 3, 1], [null, 4, 1]]);
    // Continuous numbering: run.start + local index + 1 → 1,2,3,4,5 in array order.
    const nums = runs.flatMap(r => r.items.map((_, j) => r.start + j + 1));
    expect(nums).toEqual([1, 2, 3, 4, 5]);
  });

  it("sectionRuns does NOT merge non-adjacent same-group runs (unlike groupBy)", () => {
    const runs = sectionRuns([{ group: "A" }, { group: "B" }, { group: "A" }]);
    expect(runs.map(r => r.group)).toEqual(["A", "B", "A"]);
  });

  it("moveWithAdopt: an item adopts the section of its new predecessor", () => {
    const items = [
      { id: "a" },                    // hors section
      { id: "b", group: "Caramel" },
      { id: "c", group: "Pâte" },
    ];
    // Move a (idx 0) down to idx 1 → predecessor becomes b (Caramel) → a adopts Caramel.
    let out = moveWithAdopt(items, 0, 1);
    expect(out.find(i => i.id === "a").group).toBe("Caramel");
    // Move c (idx 2) up to the very top (idx 0) → no predecessor → hors section ("").
    out = moveWithAdopt(items, 2, 0);
    expect(out[0].id).toBe("c");
    expect(out[0].group || "").toBe("");
  });

  it("looseRunLabel: named run keeps its label, ungrouped runs become Préparation/Montage", () => {
    // Recette sans section → aucun en-tête.
    expect(looseRunLabel({ group: null }, false, false)).toBeNull();
    expect(looseRunLabel({ group: null }, true, false)).toBeNull();
    // Recette sectionnée : un run nommé garde son libellé.
    expect(looseRunLabel({ group: "Caramel" }, false, true)).toBe("Caramel");
    // Un run hors-section : « Montage » si dernier, « Préparation » sinon.
    expect(looseRunLabel({ group: null }, true, true)).toBe("Montage");
    expect(looseRunLabel({ group: null }, false, true)).toBe("Préparation");
    // Un run nommé garde son libellé même quand il est le dernier.
    expect(looseRunLabel({ group: "Pâte" }, true, true)).toBe("Pâte");
  });

  it("moveAcrossGroups appends when toLocal is out of range (drop on empty zone)", () => {
    const items = [{ id: "a", group: "Pâte" }, { id: "b" }];
    // Move a into the ungrouped section (group "") at the end.
    const out = moveAcrossGroups(items, "Pâte", 0, "", Infinity);
    expect(out.map(i => `${i.id}:${i.group || ""}`)).toEqual(["b:", "a:"]);
  });
});
