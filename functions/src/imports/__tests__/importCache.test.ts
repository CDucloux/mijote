import { describe, it, expect } from "vitest";
import { isFresh, sanitizeRequestId, IMPORT_CACHE_TTL_MS } from "../importCache.js";

describe("isFresh", () => {
  const now = 1_000_000_000;
  it("accepte une entrée dans la fenêtre de validité", () => {
    expect(isFresh(now - 1000, now)).toBe(true);
    expect(isFresh(now - IMPORT_CACHE_TTL_MS, now)).toBe(true);
    expect(isFresh(now, now)).toBe(true);
  });
  it("refuse une entrée périmée, future ou de type invalide", () => {
    expect(isFresh(now - IMPORT_CACHE_TTL_MS - 1, now)).toBe(false);
    expect(isFresh(now + 1000, now)).toBe(false); // horodatage futur : incohérent
    expect(isFresh(0, now)).toBe(false);
    expect(isFresh("abc", now)).toBe(false);
    expect(isFresh(undefined, now)).toBe(false);
  });
});

describe("sanitizeRequestId", () => {
  it("accepte un identifiant alphanumérique court", () => {
    expect(sanitizeRequestId("url_1a2b3c4d5e6f7a8b")).toBe("url_1a2b3c4d5e6f7a8b");
    expect(sanitizeRequestId("photo_deadbeef")).toBe("photo_deadbeef");
  });
  it("refuse une valeur non conforme (chemin, trop longue, non chaîne)", () => {
    expect(sanitizeRequestId("../../admin/doc")).toBeNull();
    expect(sanitizeRequestId("a/b")).toBeNull();
    expect(sanitizeRequestId("x".repeat(81))).toBeNull();
    expect(sanitizeRequestId("")).toBeNull();
    expect(sanitizeRequestId(42)).toBeNull();
    expect(sanitizeRequestId(null)).toBeNull();
  });
});
