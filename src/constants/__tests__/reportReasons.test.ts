import { describe, it, expect } from "vitest";
import { REPORT_REASONS, reportReasonLabel } from "../reportReasons.js";

describe("reportReasonLabel", () => {
  it("traduit un id connu en libellé lisible", () => {
    expect(reportReasonLabel("spam")).toBe("Spam ou hors-sujet");
  });
  it("rend l'id brut pour un motif inconnu ou vide", () => {
    expect(reportReasonLabel("legacy")).toBe("legacy");
    expect(reportReasonLabel("")).toBe("");
  });
  it("ids uniques", () => {
    expect(new Set(REPORT_REASONS.map(reason => reason.id)).size).toBe(REPORT_REASONS.length);
  });
});
