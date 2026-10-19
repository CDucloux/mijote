import { describe, it, expect } from "vitest";
import { mondayWeekDays, shiftWeeks } from "@/lib/planning/weekDays.js";

describe("mondayWeekDays", () => {
  it("renvoie la semaine du lundi au dimanche pour un mercredi", () => {
    expect(mondayWeekDays(new Date("2026-10-21T12:00"))).toEqual([
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
  });

  it("rattache un dimanche à la semaine commencée le lundi précédent", () => {
    expect(mondayWeekDays(new Date("2026-10-25T12:00"))[0]).toBe("2026-10-19");
  });

  it("garde un lundi comme premier jour et traverse un changement de mois", () => {
    const days = mondayWeekDays(new Date("2026-10-26T12:00"));
    expect(days[0]).toBe("2026-10-26");
    expect(days[6]).toBe("2026-11-01");
  });

  it("ne mute pas la date de référence", () => {
    const ref = new Date("2026-10-21T12:00");
    mondayWeekDays(ref);
    expect(ref.getDate()).toBe(21);
  });
});

describe("shiftWeeks", () => {
  it("avance et recule d'une semaine sans muter l'original", () => {
    const ref = new Date("2026-10-21T12:00");
    expect(shiftWeeks(ref, 1).getDate()).toBe(28);
    expect(shiftWeeks(ref, -1).getDate()).toBe(14);
    expect(ref.getDate()).toBe(21);
  });

  it("renvoie une copie pour un décalage nul", () => {
    const ref = new Date("2026-10-21T12:00");
    const same = shiftWeeks(ref, 0);
    expect(same).not.toBe(ref);
    expect(same.getTime()).toBe(ref.getTime());
  });
});
