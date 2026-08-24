import { describe, it, expect } from "vitest";
import {
  startTimer, remainingSecs, hasElapsed, markDone,
  pauseTimer, resumeTimer, resetTimer, hasActiveDuration,
} from "@/lib/planning/cookTimers.js";

const T0 = 1_000_000;
const init = (minutes = 6, over = {}) => ({ minutes, label: `${minutes} min`, stepIdx: 2, stepLabel: "Étape 3", ...over });

describe("startTimer", () => {
  it("crée un minuteur en marche avec une échéance absolue", () => {
    const t = startTimer(init(6), T0);
    expect(t.running).toBe(true);
    expect(t.done).toBe(false);
    expect(t.totalSec).toBe(360);
    expect(t.endAt).toBe(T0 + 360_000);
    expect(t.stepIdx).toBe(2);
    expect(t.stepLabel).toBe("Étape 3");
    expect(remainingSecs(t, T0)).toBe(360);
  });

  it("génère des identifiants distincts pour deux minuteurs de même durée", () => {
    const a = startTimer(init(6), T0);
    const b = startTimer(init(6), T0);
    expect(a.id).not.toBe(b.id);
  });
});

describe("remainingSecs", () => {
  it("se dérive de l'horloge pour un minuteur en marche (survit à l'arrière-plan)", () => {
    const t = startTimer(init(6), T0);
    expect(remainingSecs(t, T0 + 60_000)).toBe(300);
    // Gros saut (retour d'arrière-plan) : le restant se recale, jamais négatif.
    expect(remainingSecs(t, T0 + 999_000_000)).toBe(0);
  });

  it("arrondit au plafond pour afficher la durée pleine au lancement", () => {
    const t = startTimer(init(6), T0);
    expect(remainingSecs(t, T0 + 1)).toBe(360);
    expect(remainingSecs(t, T0 + 1500)).toBe(359);
  });

  it("lit le restant figé quand le minuteur est en pause", () => {
    const paused = pauseTimer(startTimer(init(6), T0), T0 + 60_000);
    expect(paused.running).toBe(false);
    expect(remainingSecs(paused, T0 + 5_000_000)).toBe(300); // insensible au temps qui passe
  });
});

describe("hasElapsed", () => {
  it("détecte un minuteur en marche dont l'échéance est passée", () => {
    const t = startTimer(init(1), T0);
    expect(hasElapsed(t, T0 + 30_000)).toBe(false);
    expect(hasElapsed(t, T0 + 60_000)).toBe(true);
  });

  it("est faux pour un minuteur en pause ou déjà terminé", () => {
    const t = startTimer(init(1), T0);
    expect(hasElapsed(pauseTimer(t, T0 + 10_000), T0 + 60_000)).toBe(false);
    expect(hasElapsed(markDone(t), T0 + 60_000)).toBe(false);
  });
});

describe("pause / resume", () => {
  it("la reprise recale l'échéance sur le restant figé", () => {
    const t = startTimer(init(6), T0);
    const paused = pauseTimer(t, T0 + 100_000); // 260 s restants
    const resumed = resumeTimer(paused, T0 + 500_000);
    expect(resumed.running).toBe(true);
    expect(resumed.endAt).toBe(T0 + 500_000 + 260_000);
    expect(remainingSecs(resumed, T0 + 500_000)).toBe(260);
  });

  it("pause/resume sont sans effet sur un minuteur terminé", () => {
    const done = markDone(startTimer(init(6), T0));
    expect(pauseTimer(done, T0)).toBe(done);
    expect(resumeTimer(done, T0)).toBe(done);
  });
});

describe("markDone / resetTimer", () => {
  it("markDone fige à zéro et coupe la marche", () => {
    const d = markDone(startTimer(init(6), T0));
    expect(d.done).toBe(true);
    expect(d.running).toBe(false);
    expect(remainingSecs(d, T0 + 999)).toBe(0);
  });

  it("resetTimer relance depuis la durée totale", () => {
    const d = markDone(startTimer(init(6), T0));
    const r = resetTimer(d, T0 + 999_999);
    expect(r.done).toBe(false);
    expect(r.running).toBe(true);
    expect(remainingSecs(r, T0 + 999_999)).toBe(360);
  });
});

describe("hasActiveDuration", () => {
  it("repère un minuteur actif de même durée, ignore les terminés/pausés", () => {
    const active = startTimer(init(6), T0);
    expect(hasActiveDuration([active], 6)).toBe(true);
    expect(hasActiveDuration([active], 10)).toBe(false);
    expect(hasActiveDuration([markDone(active)], 6)).toBe(false);
    expect(hasActiveDuration([pauseTimer(active, T0 + 1000)], 6)).toBe(false);
    expect(hasActiveDuration([], 6)).toBe(false);
  });
});
