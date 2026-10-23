import { describe, it, expect } from "vitest";
import { pickFrenchVoice } from "@/lib/cookSession/speechVoice.js";

const voice = (name: string, lang: string) => ({ name, lang });

describe("pickFrenchVoice", () => {
  it("préfère une voix neuronale (Edge Natural) aux voix locales", () => {
    const voices = [voice("Microsoft Hortense - French (France)", "fr-FR"), voice("Microsoft Denise Online (Natural) - French (France)", "fr-FR"), voice("Google français", "fr-FR")];
    expect(pickFrenchVoice(voices)?.name).toContain("Denise");
  });
  it("préfère la voix Google à une voix locale dans Chrome", () => {
    expect(pickFrenchVoice([voice("Microsoft Paul", "fr-FR"), voice("Google français", "fr-FR")])?.name).toBe("Google français");
  });
  it("reconnaît les voix améliorées de Safari", () => {
    expect(pickFrenchVoice([voice("Thomas", "fr-FR"), voice("Audrey (Améliorée)", "fr-FR")])?.name).toBe("Audrey (Améliorée)");
  });
  it("préfère le français de France à qualité égale", () => {
    expect(pickFrenchVoice([voice("Amélie", "fr-CA"), voice("Thomas", "fr-FR")])?.lang).toBe("fr-FR");
    expect(pickFrenchVoice([voice("Amélie", "fr_CA")])?.lang).toBe("fr_CA");
  });
  it("ignore les voix étrangères, même naturelles, et rend null sans voix française", () => {
    expect(pickFrenchVoice([voice("Microsoft Aria Online (Natural)", "en-US"), voice("Thomas", "fr-FR")])?.name).toBe("Thomas");
    expect(pickFrenchVoice([voice("Samantha", "en-US")])).toBeNull();
    expect(pickFrenchVoice([])).toBeNull();
  });
});
