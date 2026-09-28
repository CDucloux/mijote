import { describe, it, expect } from "vitest";
import { buildMealPlanIcs } from "@/lib/planning/mealPlanIcs.js";

const NOW = new Date("2026-01-15T09:30:45Z");
const recipes = [
  { id: "r1", name: "Soupe, potiron", description: "Douce; réconfortante", servings: 4, prepTime: 15, cookTime: 30, healthScore: 82, source: "Maison", ingredients: [{ name: "Potiron", amount: 800, unit: "g" }] },
  { id: "r2", name: "Salade", servings: 2, prepTime: 10, cookTime: 0 },
];

describe("buildMealPlanIcs", () => {
  it("retourne null quand aucun repas exportable", () => {
    expect(buildMealPlanIcs({}, recipes, {}, NOW)).toBeNull();
    // repas dont la recette n'existe plus → ignoré → null
    expect(buildMealPlanIcs({ "2026-01-19": [{ recipeId: "ghost", slot: "midi" }] }, recipes, {}, NOW)).toBeNull();
  });

  it("génère un VEVENT par repas résolu, encadré par le VCALENDAR", () => {
    const ics = buildMealPlanIcs({ "2026-01-19": [{ recipeId: "r1", slot: "midi" }, { recipeId: "r2", slot: "soir" }] }, recipes, {}, NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
    // lignes séparées par CRLF
    expect(ics.includes("\r\n")).toBe(true);
  });

  it("horodate selon le créneau et échappe les séparateurs ICS", () => {
    const ics = buildMealPlanIcs({ "2026-01-19": [{ recipeId: "r1", slot: "midi" }] }, recipes, {}, NOW);
    expect(ics).toContain("DTSTART;TZID=Europe/Paris:20260119T120000");
    expect(ics).toContain("DTEND;TZID=Europe/Paris:20260119T133000");
    expect(ics).toContain("UID:2026-01-19-midi-r1@recipeapp");
    // la virgule du nom et le point-virgule de la description sont échappés
    expect(ics).toContain("SUMMARY:Déjeuner – Soupe\\, potiron");
    expect(ics).toContain("Douce\\; réconfortante");
  });

  it("slot inconnu → repli sur le créneau midi", () => {
    const ics = buildMealPlanIcs({ "2026-01-19": [{ recipeId: "r2", slot: "brunch" }] }, recipes, {}, NOW);
    expect(ics).toContain("20260119T120000");
  });

  it("mode foyer (>1 membre) : organisateur + participants, en excluant soi-même", () => {
    const ics = buildMealPlanIcs(
      { "2026-01-19": [{ recipeId: "r1", slot: "midi" }] },
      recipes,
      { organizerName: "Alice", organizerEmail: "Alice@Mail.com", memberEmails: ["alice@mail.com", "bob@mail.com"] },
      NOW,
    );
    expect(ics).toContain("ORGANIZER;CN=Alice:mailto:alice@mail.com");
    expect(ics).toContain("ATTENDEE;CN=bob@mail.com");
    // l'organisateur n'est pas aussi listé en ATTENDEE
    expect(ics).not.toContain("ATTENDEE;CN=alice@mail.com");
  });

  it("solo ou membre unique : aucune ligne organisateur/participant", () => {
    const ics = buildMealPlanIcs(
      { "2026-01-19": [{ recipeId: "r1", slot: "midi" }] },
      recipes,
      { organizerEmail: "solo@mail.com", memberEmails: ["solo@mail.com"] },
      NOW,
    );
    expect(ics).not.toContain("ORGANIZER");
    expect(ics).not.toContain("ATTENDEE");
  });
});
