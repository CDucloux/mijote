import { describe, it, expect } from "vitest";
import { isIOSPlatform, elasticStrategy } from "../elasticStrategy.js";

describe("isIOSPlatform", () => {
  it("détecte iPhone / iPad / iPod via l'user-agent", () => {
    expect(isIOSPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", "iPhone", 5)).toBe(true);
    expect(isIOSPlatform("Mozilla/5.0 (iPad; CPU OS 16_0)", "iPad", 5)).toBe(true);
    expect(isIOSPlatform("Mozilla/5.0 (iPod touch)", "iPod", 5)).toBe(true);
  });

  it("rattrape iPadOS 13+ déguisé en Mac (MacIntel + écran tactile)", () => {
    expect(isIOSPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "MacIntel", 5)).toBe(true);
  });

  it("ne confond pas un vrai Mac (MacIntel sans tactile)", () => {
    expect(isIOSPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)", "MacIntel", 0)).toBe(false);
  });

  it("est faux sur Android et desktop non tactile", () => {
    expect(isIOSPlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)", "Linux armv8l", 5)).toBe(false);
    expect(isIOSPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Win32", 0)).toBe(false);
  });
});

describe("elasticStrategy", () => {
  it("garde le custom en coquille iOS et sur iOS web/PWA", () => {
    expect(elasticStrategy("capacitor-ios", true)).toBe("custom");
    expect(elasticStrategy("browser", true)).toBe("custom");
    expect(elasticStrategy("pwa", true)).toBe("custom");
  });

  it("prend le natif en coquille Android et sur web/PWA non-iOS", () => {
    expect(elasticStrategy("capacitor-android", false)).toBe("native");
    expect(elasticStrategy("browser", false)).toBe("native");
    expect(elasticStrategy("pwa", false)).toBe("native");
  });

  it("la coquille Capacitor prime sur le signal iOS (Android natif même si le flag traîne)", () => {
    expect(elasticStrategy("capacitor-android", true)).toBe("native");
  });
});
