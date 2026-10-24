import { describe, it, expect } from "vitest";
import { socialPlatformOf, isSocialCaptionError, SOCIAL_CAPTION_REASON } from "../socialLink.js";

describe("socialPlatformOf", () => {
  it("reconnaît Instagram et TikTok, espaces et sous-domaines compris", () => {
    expect(socialPlatformOf(" https://www.instagram.com/reel/CDHMzITofWi/ ")).toBe("instagram");
    expect(socialPlatformOf("https://instagr.am/p/abc")).toBe("instagram");
    expect(socialPlatformOf("https://vm.tiktok.com/ZMabc/")).toBe("tiktok");
  });

  it("ignore les sites ordinaires, les faux domaines et les saisies invalides", () => {
    expect(socialPlatformOf("https://www.marmiton.org/recettes/x")).toBeNull();
    expect(socialPlatformOf("https://instagram.com.evil.io/reel/x")).toBeNull();
    expect(socialPlatformOf("instagram.com/reel/x")).toBeNull();
    expect(socialPlatformOf("")).toBeNull();
  });
});

describe("isSocialCaptionError", () => {
  it("reconnaît le motif serveur", () => {
    expect(isSocialCaptionError({ code: "failed-precondition", reason: SOCIAL_CAPTION_REASON })).toBe(true);
  });

  it("refuse les autres erreurs et les valeurs non objets", () => {
    expect(isSocialCaptionError({ code: "failed-precondition" })).toBe(false);
    expect(isSocialCaptionError({ reason: "other" })).toBe(false);
    expect(isSocialCaptionError(null)).toBe(false);
    expect(isSocialCaptionError("social-caption")).toBe(false);
  });
});
