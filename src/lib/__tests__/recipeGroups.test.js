import { describe, it, expect } from "vitest";
import { groupBy, hasGroups, groupOrder, relabelGroup } from "@/lib/recipes/recipeGroups.js";

describe("recipeGroups", () => {
  it("returns a single main section (group null) when nothing is grouped", () => {
    const items = [{ id: "a" }, { id: "b" }];
    const sections = groupBy(items);
    expect(sections).toHaveLength(1);
    expect(sections[0].group).toBeNull();
    expect(sections[0].items).toHaveLength(2);
  });

  it("puts the ungrouped section first, then named groups in first-appearance order", () => {
    const items = [
      { id: "a", group: "Crème" },
      { id: "b" },
      { id: "c", group: "Pâte" },
      { id: "d", group: "Crème" },
    ];
    const sections = groupBy(items);
    expect(sections.map(s => s.group)).toEqual([null, "Crème", "Pâte"]);
    expect(sections[1].items.map(i => i.id)).toEqual(["a", "d"]);
    expect(sections[0].items.map(i => i.id)).toEqual(["b"]);
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
});
