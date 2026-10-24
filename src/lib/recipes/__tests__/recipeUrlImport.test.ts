import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/firebase/firebase.js", () => ({ functions: {} }));
vi.mock("@/lib/firebase/imageResize.js", () => ({ prepareImageForUpload: vi.fn(), blobToBase64: vi.fn() }));

const { mapImportError } = await import("../recipeUrlImport.js");

describe("mapImportError", () => {
  it("garde le message serveur, le code sans préfixe et le motif des détails", () => {
    const err = mapImportError({ code: "functions/failed-precondition", message: "Copie la légende.", details: { reason: "social-caption", platform: "instagram" } });
    expect(err.message).toBe("Copie la légende.");
    expect(err.code).toBe("failed-precondition");
    expect(err.reason).toBe("social-caption");
  });

  it("n'invente pas de motif sans détails exploitables", () => {
    expect(mapImportError({ code: "functions/internal", message: "internal" }).reason).toBeUndefined();
    expect(mapImportError({ code: "internal", details: { reason: 42 } }).reason).toBeUndefined();
    expect(mapImportError({ code: "internal", details: "social-caption" }).reason).toBeUndefined();
  });

  it("retombe sur le message par défaut du code et sur internal sans code", () => {
    expect(mapImportError({ code: "functions/unavailable", message: "unavailable" }).message).toBe("Le service n'a pas répondu. Réessaie dans un instant.");
    expect(mapImportError(null).code).toBe("internal");
  });
});
