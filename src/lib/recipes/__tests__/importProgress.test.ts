import { describe, it, expect } from "vitest";
import { importProgress, importStepIndex, IMPORT_PROGRESS_CAP, IMPORT_STEPS } from "@/lib/recipes/importProgress.js";

describe("importProgress", () => {
  it("part de 0 et atteint ~90 % à la durée estimée", () => {
    expect(importProgress(0, 10000)).toBe(0);
    expect(importProgress(10000, 10000)).toBeGreaterThan(0.88);
    expect(importProgress(10000, 10000)).toBeLessThan(0.92);
  });
  it("progresse encore au-delà de l'estimation sans jamais atteindre le plafond", () => {
    expect(importProgress(20000, 10000)).toBeGreaterThan(importProgress(10000, 10000));
    expect(importProgress(1e9, 10000)).toBeLessThanOrEqual(IMPORT_PROGRESS_CAP);
  });
  it("borne les entrées aberrantes", () => {
    expect(importProgress(-500, 10000)).toBe(0);
    expect(importProgress(Number.NaN, 10000)).toBe(0);
    expect(importProgress(2000, 0)).toBe(importProgress(2000, 2000));
    expect(importProgress(2000, Number.NaN)).toBe(importProgress(2000, 2000));
  });
});

describe("importStepIndex", () => {
  it("répartit les phases à parts égales", () => {
    expect(importStepIndex(0)).toBe(0);
    expect(importStepIndex(IMPORT_PROGRESS_CAP / IMPORT_STEPS.length)).toBe(1);
    expect(importStepIndex(IMPORT_PROGRESS_CAP * 0.5)).toBe(2);
  });
  it("reste sur la dernière phase au plafond et au-delà, et sur la première si négatif", () => {
    expect(importStepIndex(IMPORT_PROGRESS_CAP)).toBe(IMPORT_STEPS.length - 1);
    expect(importStepIndex(1.5)).toBe(IMPORT_STEPS.length - 1);
    expect(importStepIndex(-1)).toBe(0);
  });
});
