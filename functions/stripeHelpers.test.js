import { describe, it, expect } from "vitest";
import { isActiveStatus, uidFromMetadata, subscriptionDocFields, ACTIVE_STATUSES } from "./stripeHelpers.js";

describe("isActiveStatus", () => {
  it("active / trialing → true", () => {
    expect(isActiveStatus("active")).toBe(true);
    expect(isActiveStatus("trialing")).toBe(true);
  });
  it("canceled / incomplete / past_due → false", () => {
    for (const s of ["canceled", "incomplete", "incomplete_expired", "past_due", "unpaid", undefined]) {
      expect(isActiveStatus(s)).toBe(false);
    }
  });
  it("reflète bien ACTIVE_STATUSES", () => {
    expect(ACTIVE_STATUSES).toEqual(["active", "trialing"]);
  });
});

describe("uidFromMetadata", () => {
  it("lit firebaseUID quand présent", () => {
    expect(uidFromMetadata({ metadata: { firebaseUID: "u1" } })).toBe("u1");
  });
  it("null quand absent, vide ou objet malformé", () => {
    expect(uidFromMetadata({ metadata: {} })).toBeNull();
    expect(uidFromMetadata({})).toBeNull();
    expect(uidFromMetadata(null)).toBeNull();
  });
});

describe("subscriptionDocFields", () => {
  it("extrait statut, prix, dates et cancel_at_period_end", () => {
    const sub = {
      status: "active",
      cancel_at_period_end: true,
      current_period_end: 1893456000, // 2030
      created: 1700000000,
      items: { data: [{ price: { id: "price_abc" } }] },
    };
    const d = subscriptionDocFields(sub);
    expect(d.status).toBe("active");
    expect(d.price).toBe("price_abc");
    expect(d.cancelAtPeriodEnd).toBe(true);
    expect(d.currentPeriodEnd).toBeInstanceOf(Date);
    expect(d.currentPeriodEnd.getTime()).toBe(1893456000 * 1000);
    expect(d.created).toBeInstanceOf(Date);
  });
  it("tolère un abonnement sans items ni dates", () => {
    const d = subscriptionDocFields({ status: "canceled" });
    expect(d.price).toBeNull();
    expect(d.cancelAtPeriodEnd).toBe(false);
    expect(d.currentPeriodEnd).toBeNull();
    expect(d.created).toBeNull();
  });
  it("n'inclut jamais l'uid ni de secret (seulement des champs d'état)", () => {
    const d = subscriptionDocFields({ status: "active", items: { data: [{ price: { id: "price_x" } }] } });
    expect(Object.keys(d).sort()).toEqual(["cancelAtPeriodEnd", "created", "currentPeriodEnd", "price", "status"]);
  });
});
