import { describe, it, expect } from "vitest";
import { resizeDimensions, prepareImageForUpload, MAX_EDGE } from "@/lib/firebase/imageResize.js";

describe("resizeDimensions", () => {
  it("réduit une grande image sous MAX_EDGE en préservant le ratio", () => {
    const { width, height } = resizeDimensions(4000, 3000);
    expect(Math.max(width, height)).toBeLessThanOrEqual(MAX_EDGE);
    expect(width / height).toBeCloseTo(4000 / 3000, 2);
  });

  it("n'agrandit jamais une petite image (facteur plafonné à 1)", () => {
    expect(resizeDimensions(800, 600)).toEqual({ width: 800, height: 600, scale: 1 });
  });
});

describe("prepareImageForUpload (repli sans canvas)", () => {
  // jsdom n'a ni createImageBitmap ni canvas.toBlob → on emprunte le chemin de repli.
  it("renvoie le fichier d'origine si son type est supporté", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "p.png", { type: "image/png" });
    const out = await prepareImageForUpload(file);
    expect(out.mediaType).toBe("image/png");
    expect(out.blob).toBe(file);
  });

  it("rejette un type non supporté (ex. HEIC) faute de pouvoir le convertir", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "p.heic", { type: "image/heic" });
    await expect(prepareImageForUpload(file)).rejects.toThrow(/non supporté/i);
  });
});
