import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { isActiveStatus, uidFromMetadata, subscriptionDocFields, ACTIVE_STATUSES, channelOf } from "../stripeHelpers.js";

/** Fabrique un abonnement Stripe partiel typé pour les tests (champs non pertinents ignorés). */
const sub = (o: Record<string, unknown>) => o as unknown as Stripe.Subscription;

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
    expect([...ACTIVE_STATUSES]).toEqual(["active", "trialing"]);
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
    const d = subscriptionDocFields(sub({
      status: "active",
      cancel_at_period_end: true,
      current_period_end: 1893456000, // 2030
      created: 1700000000,
      items: { data: [{ price: { id: "price_abc" } }] },
    }));
    expect(d.status).toBe("active");
    expect(d.price).toBe("price_abc");
    expect(d.cancelAtPeriodEnd).toBe(true);
    expect(d.currentPeriodEnd).toBeInstanceOf(Date);
    expect(d.currentPeriodEnd!.getTime()).toBe(1893456000 * 1000);
    expect(d.created).toBeInstanceOf(Date);
  });
  it("tolère un abonnement sans items ni dates", () => {
    const d = subscriptionDocFields(sub({ status: "canceled" }));
    expect(d.price).toBeNull();
    expect(d.cancelAtPeriodEnd).toBe(false);
    expect(d.currentPeriodEnd).toBeNull();
    expect(d.created).toBeNull();
  });
  it("n'inclut jamais l'uid ni de secret (seulement des champs d'état)", () => {
    const d = subscriptionDocFields(sub({ status: "active", items: { data: [{ price: { id: "price_x" } }] } }));
    expect(Object.keys(d).sort()).toEqual(["cancelAtPeriodEnd", "channel", "created", "currentPeriodEnd", "price", "status"]);
    expect(d.channel).toBe("stripe");
  });
});

describe("channelOf", () => {
  it("repli sur stripe quand le champ est absent (docs historiques)", () => {
    expect(channelOf(undefined)).toBe("stripe");
    expect(channelOf(null)).toBe("stripe");
    expect(channelOf({})).toBe("stripe");
    expect(channelOf({ channel: "stripe" })).toBe("stripe");
  });
  it("reconnaît play et appstore, ignore une valeur inconnue", () => {
    expect(channelOf({ channel: "play" })).toBe("play");
    expect(channelOf({ channel: "appstore" })).toBe("appstore");
    expect(channelOf({ channel: "bogus" })).toBe("stripe");
  });
});
