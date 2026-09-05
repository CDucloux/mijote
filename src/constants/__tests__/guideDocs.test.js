import { describe, it, expect } from "vitest";
import { GUIDE_DOCS, GUIDE_BY_ID } from "@/constants/guideDocs.js";

// Non-régression : le front-matter YAML de chaque thème est parsé au runtime
// (import.meta.glob eager). Un « : » non échappé dans une valeur cassait le
// parse en prod (blackscreen) sans que le build ne s'en aperçoive. Ce test
// évalue le module comme le ferait le navigateur et vérifie chaque thème.
describe("guideDocs", () => {
  it("charge tous les thèmes sans erreur de parse", () => {
    expect(GUIDE_DOCS.length).toBeGreaterThanOrEqual(10);
  });

  it("expose des métadonnées valides pour chaque thème", () => {
    for (const d of GUIDE_DOCS) {
      expect(typeof d.id).toBe("string");
      expect(d.id.length).toBeGreaterThan(0);
      expect(typeof d.title).toBe("string");
      expect(d.title.length).toBeGreaterThan(0);
      expect(typeof d.short).toBe("string");
      expect(typeof d.lead).toBe("string");
      expect(typeof d.color).toBe("string");
      expect(typeof d.icon).toBe("string");
      expect(typeof d.html).toBe("string");
      expect(d.html.length).toBeGreaterThan(0);
      // Le corps ne doit pas laisser fuiter un délimiteur de front-matter.
      expect(d.html).not.toContain("---\n");
    }
  });

  it("est trié par ordre croissant et indexé par id", () => {
    const orders = GUIDE_DOCS.map(d => d.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    for (const d of GUIDE_DOCS) expect(GUIDE_BY_ID[d.id]).toBe(d);
  });
});
