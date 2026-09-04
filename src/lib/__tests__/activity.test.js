import { describe, it, expect } from "vitest";
import {
  ACTIVITY_TYPES, isActivityType, parseActivity, tsToMillis,
  actorLabel, describeActivity, relativeTime,
} from "@/lib/notifications/activity.js";

const ev = (over = {}) => ({
  id: "a1", type: "recipe.add", actorEmail: "me@x.fr", actorName: "Corentin Ducloux",
  target: "Tarte aux pommes", count: 0, ts: 1000, ...over,
});

describe("isActivityType", () => {
  it("accepte les types connus et rejette le reste", () => {
    for (const t of ACTIVITY_TYPES) expect(isActivityType(t)).toBe(true);
    expect(isActivityType("recipe.unknown")).toBe(false);
    expect(isActivityType(null)).toBe(false);
    expect(isActivityType(42)).toBe(false);
  });
});

describe("tsToMillis", () => {
  it("lit un nombre tel quel", () => {
    expect(tsToMillis(1234, 9)).toBe(1234);
  });
  it("lit un Timestamp Firestore via toMillis", () => {
    expect(tsToMillis({ toMillis: () => 5555 }, 9)).toBe(5555);
  });
  it("retombe sur le fallback pour un ts absent/invalide", () => {
    expect(tsToMillis(undefined, 77)).toBe(77);
    expect(tsToMillis({}, 77)).toBe(77);
    expect(tsToMillis({ toMillis: () => NaN }, 77)).toBe(77);
  });
});

describe("parseActivity", () => {
  it("narrow un document valide", () => {
    const r = parseActivity("id1", { type: "shopping.add", actorEmail: "A@B.FR", actorName: "Ana", target: "X", count: 3, ts: 42 });
    expect(r).toEqual({ id: "id1", type: "shopping.add", actorEmail: "a@b.fr", actorName: "Ana", target: "X", count: 3, ts: 42 });
  });
  it("rejette un type inconnu ou un objet manquant", () => {
    expect(parseActivity("i", { type: "nope" })).toBeNull();
    expect(parseActivity("i", null)).toBeNull();
    expect(parseActivity("i", "str")).toBeNull();
  });
  it("tolère les champs manquants (défauts sûrs) et utilise le fallback ts", () => {
    const r = parseActivity("i", { type: "shopping.clear" }, 500);
    expect(r).toMatchObject({ type: "shopping.clear", actorEmail: "", actorName: "", target: "", count: 0, ts: 500 });
  });
});

describe("actorLabel", () => {
  it("dit « Toi » pour l'utilisateur courant (comparaison insensible à la casse)", () => {
    expect(actorLabel(ev({ actorEmail: "me@x.fr" }), "ME@X.FR")).toBe("Toi");
  });
  it("prend le prénom pour un autre membre", () => {
    expect(actorLabel(ev({ actorEmail: "her@x.fr" }), "me@x.fr")).toBe("Corentin");
  });
  it("retombe sur le préfixe de l'email si pas de nom", () => {
    expect(actorLabel(ev({ actorEmail: "julie@x.fr", actorName: "" }), "me@x.fr")).toBe("julie");
  });
  it("retombe sur « Le foyer » si ni nom ni email", () => {
    expect(actorLabel(ev({ actorEmail: "", actorName: "" }), "me@x.fr")).toBe("Le foyer");
  });
});

describe("describeActivity", () => {
  it("compose la phrase avec la cible", () => {
    expect(describeActivity(ev()).title).toBe("Nouvelle recette : Tarte aux pommes");
    expect(describeActivity(ev()).icon).toBe("book");
  });
  it("gère le pluriel des compteurs", () => {
    expect(describeActivity(ev({ type: "recipe.import", count: 1 })).title).toBe("1 recette importée");
    expect(describeActivity(ev({ type: "recipe.import", count: 3 })).title).toBe("3 recettes importées");
  });
  it("suffixe la recette aux courses seulement si présente", () => {
    expect(describeActivity(ev({ type: "shopping.add", count: 2, target: "Curry" })).title)
      .toBe("2 articles ajoutés aux courses · Curry");
    expect(describeActivity(ev({ type: "shopping.add", count: 1, target: "" })).title)
      .toBe("1 article ajouté aux courses");
  });
  it("couvre tous les types sans lever", () => {
    for (const t of ACTIVITY_TYPES) {
      const v = describeActivity(ev({ type: t, count: 2 }));
      expect(typeof v.title).toBe("string");
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.icon).toBeTruthy();
      expect(v.color).toBeTruthy();
    }
  });
});

describe("relativeTime", () => {
  const now = 10 * 86_400_000; // 10 jours epoch, base stable
  it("à l'instant sous la minute (et pour un futur proche)", () => {
    expect(relativeTime(now - 30_000, now)).toBe("à l'instant");
    expect(relativeTime(now + 5_000, now)).toBe("à l'instant");
  });
  it("minutes puis heures", () => {
    expect(relativeTime(now - 5 * 60_000, now)).toBe("il y a 5 min");
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe("il y a 2 h");
  });
  it("hier puis jours", () => {
    expect(relativeTime(now - 86_400_000, now)).toBe("hier");
    expect(relativeTime(now - 3 * 86_400_000, now)).toBe("il y a 3 j");
  });
  it("date courte au-delà d'une semaine", () => {
    const out = relativeTime(now - 30 * 86_400_000, now);
    expect(out).toMatch(/\d/);
    expect(out).not.toMatch(/il y a/);
  });
});
