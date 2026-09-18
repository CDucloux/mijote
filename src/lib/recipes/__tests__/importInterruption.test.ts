import { describe, it, expect } from "vitest";
import { importFailureFor, IMPORT_INTERRUPTED } from "../importInterruption.js";

describe("importFailureFor", () => {
  it("remonte le message d'interruption quand la page a été masquée", () => {
    const out = importFailureFor({ message: "internal", code: "internal" }, true);
    expect(out).toEqual(IMPORT_INTERRUPTED);
  });

  it("préserve message et code du vrai échec quand la page est restée visible", () => {
    const out = importFailureFor({ message: "Page trop volumineuse.", code: "invalid-argument" }, false);
    expect(out).toEqual({ message: "Page trop volumineuse.", code: "invalid-argument" });
  });

  it("retombe sur des valeurs par défaut si l'erreur est vide", () => {
    expect(importFailureFor(null, false)).toEqual({ message: "Import impossible.", code: "internal" });
    expect(importFailureFor({}, false)).toEqual({ message: "Import impossible.", code: "internal" });
  });
});
