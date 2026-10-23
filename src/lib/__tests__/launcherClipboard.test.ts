import { describe, it, expect, vi, beforeEach } from "vitest";

const native = vi.hoisted(() => ({ on: false, text: undefined as unknown, fail: false }));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native.on },
  registerPlugin: () => ({
    clipboardText: async () => { if (native.fail) throw new Error("refus"); return { text: native.text }; },
  }),
}));

const { readClipboardText, readClipboardLink } = await import("@/lib/launcher/plugin.js");

function stubWebClipboard(readText: () => Promise<string>) {
  vi.stubGlobal("navigator", { clipboard: { readText } });
}

describe("readClipboardText", () => {
  beforeEach(() => { native.on = false; native.text = undefined; native.fail = false; vi.unstubAllGlobals(); });

  it("lit le presse-papiers système en natif, sans passer par l'API web", async () => {
    native.on = true; native.text = "250 g de farine";
    const readText = vi.fn(async () => "web");
    stubWebClipboard(readText);
    expect(await readClipboardText()).toBe("250 g de farine");
    expect(readText).not.toHaveBeenCalled();
  });
  it("rend une chaîne vide si le natif renvoie autre chose qu'un texte ou échoue", async () => {
    native.on = true; native.text = 42;
    expect(await readClipboardText()).toBe("");
    native.fail = true;
    expect(await readClipboardText()).toBe("");
  });
  it("passe par l'API web hors natif, refus compris", async () => {
    stubWebClipboard(async () => "texte web");
    expect(await readClipboardText()).toBe("texte web");
    stubWebClipboard(async () => { throw new Error("NotAllowedError"); });
    expect(await readClipboardText()).toBe("");
  });
  it("extrait le premier lien copié", async () => {
    stubWebClipboard(async () => "vu ici https://exemple.com/tarte et là");
    expect(await readClipboardLink()).toBe("https://exemple.com/tarte");
    stubWebClipboard(async () => "pas de lien");
    expect(await readClipboardLink()).toBeNull();
  });
});
