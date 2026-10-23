import { describe, it, expect, vi, beforeEach } from "vitest";

const bridge = vi.hoisted(() => ({
  native: true,
  listeners: new Map<string, (event: unknown) => void>(),
  calls: [] as [string, unknown][],
  failStart: false,
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => bridge.native },
  registerPlugin: () => ({
    start: async (options: unknown) => { bridge.calls.push(["start", options]); if (bridge.failStart) throw new Error("refus"); },
    stop: async () => { bridge.calls.push(["stop", undefined]); },
    speak: async (options: unknown) => { bridge.calls.push(["speak", options]); },
    stopSpeaking: async () => { bridge.calls.push(["stopSpeaking", undefined]); },
    addListener: async (name: string, listener: (event: unknown) => void) => { bridge.listeners.set(name, listener); return { remove: async () => {} }; },
  }),
}));

const { isNativeVoice, NativeRecognition, nativeSpeech } = await import("@/lib/voice/plugin.js");
const emit = (name: string, event: unknown = {}) => bridge.listeners.get(name)?.(event);

describe("NativeRecognition", () => {
  beforeEach(() => { bridge.calls = []; bridge.failStart = false; });

  it("lance la dictée native dans la langue demandée", () => {
    const recognition = new NativeRecognition();
    recognition.lang = "fr-FR";
    recognition.start();
    expect(bridge.calls).toContainEqual(["start", { lang: "fr-FR" }]);
  });
  it("relaie les événements natifs au format du navigateur", () => {
    const recognition = new NativeRecognition();
    const onresult = vi.fn(), onaudiostart = vi.fn(), onspeechstart = vi.fn(), onerror = vi.fn(), onend = vi.fn();
    Object.assign(recognition, { onresult, onaudiostart, onspeechstart, onerror, onend });
    recognition.start();
    emit("state", { state: "listening" });
    emit("state", { state: "hearing" });
    emit("result", { transcript: "suivant", isFinal: false });
    emit("error", { error: "no-speech" });
    emit("end");
    expect(onaudiostart).toHaveBeenCalledOnce();
    expect(onspeechstart).toHaveBeenCalledOnce();
    expect(onresult).toHaveBeenCalledWith({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: "suivant" } }] });
    expect(onerror).toHaveBeenCalledWith({ error: "no-speech" });
    expect(onend).toHaveBeenCalledOnce();
  });
  it("ignore les événements natifs malformés", () => {
    const recognition = new NativeRecognition();
    const onresult = vi.fn(), onerror = vi.fn();
    Object.assign(recognition, { onresult, onerror });
    recognition.start();
    emit("result", { transcript: 42 });
    emit("result", null);
    emit("error", {});
    expect(onresult).not.toHaveBeenCalled();
    expect(onerror).toHaveBeenCalledWith({ error: "aborted" });
  });
  it("ne relaie qu'à la dernière dictée lancée", () => {
    const first = new NativeRecognition(), second = new NativeRecognition();
    first.onend = vi.fn(); second.onend = vi.fn();
    first.start(); second.start();
    emit("end");
    expect(first.onend).not.toHaveBeenCalled();
    expect(second.onend).toHaveBeenCalledOnce();
  });
  it("signale la fin elle-même à l'arrêt, le système ne le faisant pas toujours", async () => {
    const recognition = new NativeRecognition();
    recognition.onend = vi.fn();
    recognition.start();
    recognition.abort();
    await Promise.resolve();
    expect(bridge.calls).toContainEqual(["stop", undefined]);
    expect(recognition.onend).toHaveBeenCalledOnce();
  });
  it("transforme un échec de lancement en erreur de capture puis fin", async () => {
    bridge.failStart = true;
    const recognition = new NativeRecognition();
    recognition.onerror = vi.fn(); recognition.onend = vi.fn();
    recognition.start();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(recognition.onerror).toHaveBeenCalledWith({ error: "audio-capture" });
    expect(recognition.onend).toHaveBeenCalledOnce();
  });
});

describe("nativeSpeech", () => {
  beforeEach(() => { bridge.calls = []; });

  it("lit par le moteur du système et suit l'état de lecture", () => {
    nativeSpeech.speak("Étape 1.");
    expect(bridge.calls).toContainEqual(["speak", { text: "Étape 1." }]);
    expect(nativeSpeech.speaking).toBe(true);
    emit("speaking", { speaking: false });
    expect(nativeSpeech.speaking).toBe(false);
    emit("speaking", { speaking: true });
    expect(nativeSpeech.speaking).toBe(true);
  });
  it("coupe la lecture", () => {
    nativeSpeech.speak("Étape 2.");
    nativeSpeech.cancel();
    expect(nativeSpeech.speaking).toBe(false);
    expect(bridge.calls).toContainEqual(["stopSpeaking", undefined]);
  });
});

describe("isNativeVoice", () => {
  it("suit la plateforme Capacitor", () => {
    bridge.native = true;
    expect(isNativeVoice()).toBe(true);
    bridge.native = false;
    expect(isNativeVoice()).toBe(false);
  });
});
