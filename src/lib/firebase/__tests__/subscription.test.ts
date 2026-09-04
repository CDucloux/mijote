import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// On capture les callbacks passés à onSnapshot pour piloter le test.
let successCb: ((snap: unknown) => void) | null = null;
let errorCb: (() => void) | null = null;
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: (_ref: unknown, onNext: (s: unknown) => void, onError: () => void) => {
    successCb = onNext; errorCb = onError; return () => {};
  },
}));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn(), getFunctions: vi.fn() }));
vi.mock("@/lib/firebase/firebase.js", () => ({ db: {}, firebaseApp: {} }));

import { derivePlanPeriod, parseActiveSubscription, subscribeToPlan, EMPTY_PLAN } from "../subscription.js";

/** Timestamp Firestore minimal : porte un `.toDate()`. */
const ts = (d: Date) => ({ toDate: () => d });
/** Snapshot minimal : un seul doc porteur des `data`. */
const snapWith = (data: unknown) => ({ empty: false, docs: [{ data: () => data }] });

beforeEach(() => { successCb = null; errorCb = null; });
afterEach(() => { vi.unstubAllEnvs(); });

describe("derivePlanPeriod", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_STRIPE_PRICE_YEARLY", "price_year");
    vi.stubEnv("VITE_STRIPE_PRICE_MONTHLY", "price_month");
  });
  it("dérive la périodicité du tarif Stripe", () => {
    expect(derivePlanPeriod("price_year")).toBe("yearly");
    expect(derivePlanPeriod("price_month")).toBe("monthly");
  });
  it("renvoie null pour un tarif inconnu", () => {
    expect(derivePlanPeriod("price_other")).toBeNull();
  });
  it("ne confond pas une valeur vide avec une env absente", () => {
    vi.unstubAllEnvs(); // env prix indéfinies
    expect(derivePlanPeriod(undefined)).toBeNull();
    expect(derivePlanPeriod("")).toBeNull();
    expect(derivePlanPeriod(42)).toBeNull();
  });
});

describe("parseActiveSubscription", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_STRIPE_PRICE_YEARLY", "price_year");
    vi.stubEnv("VITE_STRIPE_PRICE_MONTHLY", "price_month");
  });
  it("narrowe un doc Stripe complet", () => {
    const end = new Date("2027-03-12T00:00:00Z");
    const created = new Date("2026-03-01T00:00:00Z");
    expect(parseActiveSubscription({
      status: "active", channel: "stripe", price: "price_year",
      cancelAtPeriodEnd: true, currentPeriodEnd: ts(end), created: ts(created),
    })).toEqual({
      active: true, channel: "stripe", plan: "yearly",
      cancelAtPeriodEnd: true, currentPeriodEnd: end, since: created,
    });
  });
  it("reconnaît le canal Play", () => {
    expect(parseActiveSubscription({ channel: "play", price: "price_month" }).channel).toBe("play");
  });
  it("retombe sur stripe pour un canal inattendu", () => {
    expect(parseActiveSubscription({ channel: "appstore" }).channel).toBe("stripe");
  });
  it("dégrade proprement sur des champs manquants (reste actif)", () => {
    expect(parseActiveSubscription({})).toEqual({
      active: true, channel: "stripe", plan: null,
      cancelAtPeriodEnd: false, currentPeriodEnd: null, since: null,
    });
  });
  it("tolère une valeur de date inattendue", () => {
    expect(parseActiveSubscription({ currentPeriodEnd: "pas une date" }).currentPeriodEnd).toBeNull();
  });
});

describe("subscribeToPlan", () => {
  it("émet l'état parsé du premier doc actif", () => {
    const cb = vi.fn();
    subscribeToPlan("me", cb);
    successCb?.(snapWith({ channel: "stripe" }));
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ active: true, channel: "stripe" }));
  });
  it("émet EMPTY_PLAN sur snapshot vide", () => {
    const cb = vi.fn();
    subscribeToPlan("me", cb);
    successCb?.({ empty: true, docs: [] });
    expect(cb).toHaveBeenCalledWith(EMPTY_PLAN);
  });
  it("émet EMPTY_PLAN en cas d'erreur", () => {
    const cb = vi.fn();
    subscribeToPlan("me", cb);
    errorCb?.();
    expect(cb).toHaveBeenCalledWith(EMPTY_PLAN);
  });
});
