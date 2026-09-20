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
  it("garde le custom dans les coquilles Capacitor (iOS comme Android)", () => {
    expect(elasticStrategy("capacitor-ios", true)).toBe("custom");
    expect(elasticStrategy("capacitor-android", false)).toBe("custom");
    expect(elasticStrategy("capacitor-android", true)).toBe("custom");
  });

  it("garde le custom sur iOS web/PWA (pas de rebond natif sur scrollers internes)", () => {
    expect(elasticStrategy("browser", true)).toBe("custom");
    expect(elasticStrategy("pwa", true)).toBe("custom");
  });

  it("prend le natif sur le web/PWA hors iOS (overscroll fourni par le navigateur)", () => {
    expect(elasticStrategy("browser", false)).toBe("native");
    expect(elasticStrategy("pwa", false)).toBe("native");
  });
});
