import { describe, it, expect } from "vitest";
import { opensSoftKeyboard } from "@/lib/ui/softKeyboard.js";

// Petit fabricant d'élément sans DOM complet : tagName + attributs suffisent.
function el(tag, attrs = {}, extra = {}) {
  return {
    tagName: tag,
    getAttribute: (k) => (k in attrs ? attrs[k] : null),
    ...extra,
  };
}

describe("opensSoftKeyboard", () => {
  it("null / absence de cible → false", () => {
    expect(opensSoftKeyboard(null)).toBe(false);
  });

  it("textarea → true", () => {
    expect(opensSoftKeyboard(el("TEXTAREA"))).toBe(true);
  });

  it("input texte (sans type explicite) → true", () => {
    expect(opensSoftKeyboard(el("INPUT"))).toBe(true);
  });

  it("input de recherche → true", () => {
    expect(opensSoftKeyboard(el("INPUT", { type: "search" }))).toBe(true);
    expect(opensSoftKeyboard(el("INPUT", { type: "email" }))).toBe(true);
    expect(opensSoftKeyboard(el("INPUT", { type: "number" }))).toBe(true);
  });

  it("input non textuel (bouton, case, curseur…) → false", () => {
    for (const type of ["button", "submit", "checkbox", "radio", "range", "color", "file"]) {
      expect(opensSoftKeyboard(el("INPUT", { type }))).toBe(false);
    }
  });

  it("type en casse mixte est normalisé", () => {
    expect(opensSoftKeyboard(el("INPUT", { type: "Checkbox" }))).toBe(false);
    expect(opensSoftKeyboard(el("INPUT", { type: "SEARCH" }))).toBe(true);
  });

  it("élément contenteditable → true, sinon false", () => {
    expect(opensSoftKeyboard(el("DIV", {}, { isContentEditable: true }))).toBe(true);
    expect(opensSoftKeyboard(el("DIV", {}, { isContentEditable: false }))).toBe(false);
    expect(opensSoftKeyboard(el("BUTTON"))).toBe(false);
  });
});
