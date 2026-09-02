import { describe, it, expect } from "vitest";
import { HOUSEHOLD_NAME_MAX, sanitizeHouseholdName, buildHouseholdDoc } from "../householdHelpers.js";

describe("sanitizeHouseholdName", () => {
  it("trim et conserve un nom valide", () => {
    expect(sanitizeHouseholdName("  Maison Dupont  ")).toBe("Maison Dupont");
  });
  it("replie sur « Mon foyer » quand vide ou blanc", () => {
    expect(sanitizeHouseholdName("")).toBe("Mon foyer");
    expect(sanitizeHouseholdName("   ")).toBe("Mon foyer");
  });
  it("replie sur « Mon foyer » pour une entrée non-chaîne (payload forgé)", () => {
    expect(sanitizeHouseholdName(undefined)).toBe("Mon foyer");
    expect(sanitizeHouseholdName(null)).toBe("Mon foyer");
    expect(sanitizeHouseholdName(42)).toBe("Mon foyer");
    expect(sanitizeHouseholdName({ toString: () => "x" })).toBe("Mon foyer");
  });
  it("plafonne la longueur à HOUSEHOLD_NAME_MAX", () => {
    const long = "a".repeat(HOUSEHOLD_NAME_MAX + 20);
    expect(sanitizeHouseholdName(long)).toHaveLength(HOUSEHOLD_NAME_MAX);
  });
});

describe("buildHouseholdDoc", () => {
  it("inscrit le créateur owner + unique membre, sans invitation", () => {
    const h = buildHouseholdDoc("u1", "Owner@Mail.com", "  Maison  ", 1000);
    expect(h).toEqual({
      name: "Maison",
      ownerUid: "u1",
      memberUids: ["u1"],
      memberEmails: ["owner@mail.com"],
      invitedEmails: [],
      createdAt: 1000,
    });
  });
  it("normalise l'email en minuscules et le retire si absent", () => {
    expect(buildHouseholdDoc("u1", undefined, "M", 1).memberEmails).toEqual([]);
    expect(buildHouseholdDoc("u1", "  ", "M", 1).memberEmails).toEqual([]);
    expect(buildHouseholdDoc("u1", "A@B.COM", "M", 1).memberEmails).toEqual(["a@b.com"]);
  });
  it("respecte les invariants attendus par les règles Firestore (owner = seul membre, 0 invité)", () => {
    const h = buildHouseholdDoc("uX", "x@y.z", "", 1);
    expect(h.ownerUid).toBe("uX");
    expect(h.memberUids).toEqual(["uX"]);
    expect(h.invitedEmails).toHaveLength(0);
    expect(h.name).toBe("Mon foyer");
  });
});
