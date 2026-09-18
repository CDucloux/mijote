import { describe, it, expect } from "vitest";
import { hashString, importRequestId } from "../importIdempotency.js";

describe("hashString", () => {
  it("est déterministe et de longueur fixe (16 hex)", () => {
    const a = hashString("https://exemple.com/tarte");
    const b = hashString("https://exemple.com/tarte");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("distingue des contenus différents", () => {
    expect(hashString("recette A")).not.toBe(hashString("recette B"));
    expect(hashString("")).not.toBe(hashString(" "));
  });
});

describe("importRequestId", () => {
  it("préfixe par le type et reste stable pour un même contenu", () => {
    const id = importRequestId("url", "https://exemple.com/x");
    expect(id).toBe(importRequestId("url", "https://exemple.com/x"));
    expect(id.startsWith("url_")).toBe(true);
  });

  it("sépare les types même à contenu identique", () => {
    expect(importRequestId("url", "abc")).not.toBe(importRequestId("text", "abc"));
  });
});
