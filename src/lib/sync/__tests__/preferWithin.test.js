import { describe, it, expect, vi, afterEach } from "vitest";
import { preferWithin, bootReadBudget, BOOT_SERVER_BUDGET_MS } from "@/lib/sync/preferWithin.js";

const later = (ms, value) => new Promise(r => setTimeout(() => r(value), ms));
const failLater = (ms, err) => new Promise((_, rej) => setTimeout(() => rej(err), ms));

afterEach(() => { vi.useRealTimers(); });

describe("preferWithin", () => {
  it("garde le primaire quand il répond dans le budget, sans toucher au repli", async () => {
    vi.useFakeTimers();
    const fallback = vi.fn(async () => "cache");
    const p = preferWithin(later(300, "serveur"), fallback, 1200);
    await vi.advanceTimersByTimeAsync(300);
    await expect(p).resolves.toEqual({ value: "serveur", source: "primary" });
    expect(fallback).not.toHaveBeenCalled();
  });

  it("sert le repli quand le primaire dépasse le budget", async () => {
    vi.useFakeTimers();
    const p = preferWithin(later(10_000, "serveur"), async () => "cache", 1200);
    await vi.advanceTimersByTimeAsync(1200);
    await expect(p).resolves.toEqual({ value: "cache", source: "fallback" });
  });

  it("attend le primaire si le repli n'a rien (cache vide, premier lancement)", async () => {
    vi.useFakeTimers();
    const p = preferWithin(later(3000, "serveur"), async () => null, 1200);
    await vi.advanceTimersByTimeAsync(3000);
    await expect(p).resolves.toEqual({ value: "serveur", source: "primary" });
  });

  it("interroge le repli tout de suite avec un budget nul (hors ligne déclaré)", async () => {
    const fallback = vi.fn(async () => "cache");
    await expect(preferWithin(new Promise(() => { }), fallback, 0)).resolves.toEqual({ value: "cache", source: "fallback" });
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("se rabat sur le repli si le primaire échoue avant le budget", async () => {
    vi.useFakeTimers();
    const p = preferWithin(failLater(100, new Error("unavailable")), async () => "cache", 1200);
    await vi.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toEqual({ value: "cache", source: "fallback" });
  });

  it("propage l'erreur du primaire quand le repli n'a rien", async () => {
    vi.useFakeTimers();
    const p = preferWithin(failLater(100, new Error("unavailable")), async () => null, 1200);
    const check = expect(p).rejects.toThrow("unavailable");
    await vi.advanceTimersByTimeAsync(100);
    await check;
  });

  it("traite un repli qui lève comme un repli vide", async () => {
    vi.useFakeTimers();
    const p = preferWithin(later(2000, "serveur"), async () => { throw new Error("cache illisible"); }, 1200);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toEqual({ value: "serveur", source: "primary" });
  });
});

describe("bootReadBudget", () => {
  it("lit le cache tout de suite hors ligne déclaré", () => {
    expect(bootReadBudget(false)).toBe(0);
  });
  it("laisse au serveur le budget de démarrage en ligne", () => {
    expect(bootReadBudget(true)).toBe(BOOT_SERVER_BUDGET_MS);
    expect(BOOT_SERVER_BUDGET_MS).toBeGreaterThan(0);
  });
});
