import { describe, it, expect } from "vitest";
import { toSharedTimerEntry, parseSharedTimers, mergeSharedTimers } from "@/lib/cookSession/sharedTimers.js";
import { startTimer, pauseTimer, markDone } from "@/lib/planning/cookTimers.js";

const T0 = 1_800_000_000_000;
const PAGES = ["overview", "step:0", "step:1", "step:2"];
const timer = (minutes = 3, over = {}) => ({ ...startTimer({ minutes, label: `${minutes} min`, stepIdx: 2, stepLabel: "Étape 2" }, T0), ...over });
const entry = (over = {}) => ({ label: "3 min", totalSec: 180, running: true, endAt: T0 + 180_000, remainingMs: 180_000, page: "step:1", stepLabel: "Étape 2", startedBy: "her", ...over });

describe("toSharedTimerEntry", () => {
  it("publie l'échéance, la page source et le lanceur", () => {
    const t = timer();
    expect(toSharedTimerEntry(t, "step:1", "me")).toEqual({
      label: "3 min", totalSec: 180, running: true, endAt: T0 + 180_000, remainingMs: 180_000, page: "step:1", stepLabel: "Étape 2", startedBy: "me",
    });
  });
  it("garde le lanceur d'origine d'un minuteur relancé par l'autre membre", () => {
    expect(toSharedTimerEntry(timer(3, { startedBy: "her" }), "step:1", "me").startedBy).toBe("her");
  });
  it("un minuteur terminé est publié figé, jamais « en marche »", () => {
    const e = toSharedTimerEntry(markDone(timer()), "step:1", "me");
    expect(e).toMatchObject({ running: false, endAt: null, remainingMs: 0 });
    expect(Object.values(e)).not.toContain(undefined);
  });
});

describe("parseSharedTimers", () => {
  it("relit un minuteur et retrouve l'index local de sa page", () => {
    const [t] = parseSharedTimers({ timers: { a: entry() } }, PAGES);
    expect(t).toEqual({
      id: "a", label: "3 min", totalSec: 180, running: true, endAt: T0 + 180_000, remainingMs: 180_000,
      done: false, stepIdx: 2, stepLabel: "Étape 2", startedBy: "her",
    });
  });
  it("page inconnue localement : retombe sur la première page", () => {
    expect(parseSharedTimers({ timers: { a: entry({ page: "bases" }) } }, PAGES)[0].stepIdx).toBe(0);
  });
  it("ignore les entrées malformées une à une et trie par identifiant", () => {
    const raw = { timers: { b: entry(), bad: { totalSec: "3" }, zero: entry({ totalSec: 0 }), noEnd: entry({ endAt: null }), a: entry({ running: false, endAt: null, remainingMs: 42_000 }), nul: null } };
    const out = parseSharedTimers(raw, PAGES);
    expect(out.map((t) => t.id)).toEqual(["a", "b"]);
    expect(out[0]).toMatchObject({ running: false, endAt: null, remainingMs: 42_000 });
  });
  it("document absent, sans minuteurs ou malformé : liste vide", () => {
    expect(parseSharedTimers(undefined, PAGES)).toEqual([]);
    expect(parseSharedTimers({ recipeId: "r1" }, PAGES)).toEqual([]);
    expect(parseSharedTimers({ timers: [entry()] }, PAGES)).toEqual([]);
  });
  it("lanceur vide ou absent : pas de champ startedBy", () => {
    expect(parseSharedTimers({ timers: { a: entry({ startedBy: "" }) } }, PAGES)[0]).not.toHaveProperty("startedBy");
  });
});

describe("mergeSharedTimers", () => {
  it("la session fait foi : une pause de l'autre membre s'applique ici", () => {
    const local = timer();
    const remote = pauseTimer(local, T0 + 60_000);
    const { timers, pending } = mergeSharedTimers([local], [remote], new Set([local.id]), T0 + 61_000);
    expect(timers).toEqual([remote]);
    expect(pending).toEqual([]);
  });
  it("minuteur arrêté par l'autre membre (déjà vu, disparu) : il tombe ici aussi", () => {
    const local = timer();
    expect(mergeSharedTimers([local], [], new Set([local.id]), T0).timers).toEqual([]);
  });
  it("minuteur local jamais publié (lancé avant la jonction) : gardé et à publier", () => {
    const local = timer();
    const { timers, pending } = mergeSharedTimers([local], [], new Set(), T0);
    expect(timers).toEqual([local]);
    expect(pending).toEqual([local]);
  });
  it("nouveau minuteur de l'autre membre : ajouté à la suite, ordre local conservé", () => {
    const mine = timer(3, { id: "z" });
    const hers = timer(5, { id: "a" });
    expect(mergeSharedTimers([mine], [hers, mine], new Set(["z"]), T0).timers.map((t) => t.id)).toEqual(["z", "a"]);
  });
  it("échéance passée : le minuteur arrive « terminé » (non publié comme tel)", () => {
    const hers = timer(3, { id: "a" });
    const [t] = mergeSharedTimers([], [hers], new Set(), T0 + 200_000).timers;
    expect(t.done).toBe(true);
  });
  it("relance par l'autre membre d'un minuteur terminé ici : il repart", () => {
    const doneHere = markDone(timer());
    const relaunched = timer(3, { id: doneHere.id, endAt: T0 + 400_000 });
    const [t] = mergeSharedTimers([doneHere], [relaunched], new Set([doneHere.id]), T0 + 300_000).timers;
    expect(t).toMatchObject({ done: false, running: true, endAt: T0 + 400_000 });
  });
});
