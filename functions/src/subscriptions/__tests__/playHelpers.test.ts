import { describe, it, expect } from "vitest";
import {
  playStateToStatus,
  playPurchaseToDocFields,
  playPriceId,
  playProductId,
  obfuscatedAccountId,
  isAcknowledged,
  isAllowedPlayProduct,
  grantsAccess,
  parseRtdnEnvelope,
  RTDN_SUBSCRIPTION_TYPE,
  type PlaySubscriptionPurchaseV2,
} from "../playHelpers.js";

const NOW = Date.UTC(2026, 7, 30); // 2026-08-30
const FUTURE = new Date(NOW + 7 * 864e5).toISOString();
const PAST = new Date(NOW - 7 * 864e5).toISOString();

function purchase(over: Partial<PlaySubscriptionPurchaseV2> = {}): PlaySubscriptionPurchaseV2 {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
    startTime: PAST,
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    externalAccountIdentifiers: { obfuscatedExternalAccountId: "abc123" },
    lineItems: [{ productId: "cardamome_plus", expiryTime: FUTURE, autoRenewingPlan: { autoRenewEnabled: true }, offerDetails: { basePlanId: "monthly" } }],
    ...over,
  };
}

describe("playStateToStatus", () => {
  it("ACTIVE donne accès", () => {
    expect(playStateToStatus("SUBSCRIPTION_STATE_ACTIVE", NOW + 864e5, NOW)).toBe("active");
    expect(grantsAccess("active")).toBe(true);
  });

  it("IN_GRACE_PERIOD garde l'accès (paiement en retard toléré)", () => {
    const s = playStateToStatus("SUBSCRIPTION_STATE_IN_GRACE_PERIOD", NOW + 864e5, NOW);
    expect(s).toBe("active");
    expect(grantsAccess(s)).toBe(true);
  });

  it("ON_HOLD coupe l'accès", () => {
    const s = playStateToStatus("SUBSCRIPTION_STATE_ON_HOLD", NOW + 864e5, NOW);
    expect(s).toBe("past_due");
    expect(grantsAccess(s)).toBe(false);
  });

  it("PAUSED coupe l'accès", () => {
    expect(grantsAccess(playStateToStatus("SUBSCRIPTION_STATE_PAUSED", NOW + 864e5, NOW))).toBe(false);
  });

  it("CANCELED encore dans la période payée garde l'accès", () => {
    const s = playStateToStatus("SUBSCRIPTION_STATE_CANCELED", NOW + 864e5, NOW);
    expect(s).toBe("active");
    expect(grantsAccess(s)).toBe(true);
  });

  it("CANCELED expiré coupe l'accès", () => {
    const s = playStateToStatus("SUBSCRIPTION_STATE_CANCELED", NOW - 864e5, NOW);
    expect(s).toBe("canceled");
    expect(grantsAccess(s)).toBe(false);
  });

  it("CANCELED sans expiration connue coupe l'accès (défaut prudent)", () => {
    expect(grantsAccess(playStateToStatus("SUBSCRIPTION_STATE_CANCELED", null, NOW))).toBe(false);
  });

  it("EXPIRED coupe l'accès", () => {
    expect(grantsAccess(playStateToStatus("SUBSCRIPTION_STATE_EXPIRED", null, NOW))).toBe(false);
  });

  it("PENDING et état inconnu ne donnent jamais l'accès", () => {
    expect(grantsAccess(playStateToStatus("SUBSCRIPTION_STATE_PENDING", NOW + 864e5, NOW))).toBe(false);
    expect(grantsAccess(playStateToStatus("SUBSCRIPTION_STATE_UNSPECIFIED", NOW + 864e5, NOW))).toBe(false);
    expect(grantsAccess(playStateToStatus(undefined, NOW + 864e5, NOW))).toBe(false);
    expect(grantsAccess(playStateToStatus("N'IMPORTE_QUOI", NOW + 864e5, NOW))).toBe(false);
  });
});

describe("playPurchaseToDocFields", () => {
  it("mappe un abonnement actif renouvelable", () => {
    const f = playPurchaseToDocFields(purchase(), NOW);
    expect(f).toMatchObject({ status: "active", channel: "play", price: "cardamome_plus:monthly", cancelAtPeriodEnd: false });
    expect(f.currentPeriodEnd?.toISOString()).toBe(FUTURE);
    expect(f.created?.toISOString()).toBe(PAST);
  });

  it("cancelAtPeriodEnd vrai quand le renouvellement auto est coupé", () => {
    const f = playPurchaseToDocFields(purchase({ subscriptionState: "SUBSCRIPTION_STATE_CANCELED", lineItems: [{ productId: "cardamome_plus", expiryTime: FUTURE, autoRenewingPlan: { autoRenewEnabled: false } }] }), NOW);
    expect(f.status).toBe("active"); // encore dans la période payée
    expect(f.cancelAtPeriodEnd).toBe(true);
    expect(f.price).toBe("cardamome_plus"); // sans basePlanId
  });

  it("tolère des lineItems / temps absents sans planter", () => {
    const f = playPurchaseToDocFields({ subscriptionState: "SUBSCRIPTION_STATE_EXPIRED" }, NOW);
    expect(f).toMatchObject({ status: "canceled", channel: "play", price: null, cancelAtPeriodEnd: false, currentPeriodEnd: null, created: null });
  });

  it("retient l'expiration la plus tardive parmi plusieurs items", () => {
    const later = new Date(NOW + 30 * 864e5).toISOString();
    const f = playPurchaseToDocFields(purchase({ lineItems: [{ productId: "cardamome_plus", expiryTime: FUTURE }, { productId: "cardamome_plus", expiryTime: later }] }), NOW);
    expect(f.currentPeriodEnd?.toISOString()).toBe(later);
  });
});

describe("extracteurs", () => {
  it("playPriceId / playProductId", () => {
    expect(playPriceId(purchase())).toBe("cardamome_plus:monthly");
    expect(playProductId(purchase())).toBe("cardamome_plus");
    expect(playPriceId({})).toBeNull();
    expect(playProductId({})).toBeNull();
  });

  it("obfuscatedAccountId", () => {
    expect(obfuscatedAccountId(purchase())).toBe("abc123");
    expect(obfuscatedAccountId({})).toBeNull();
    expect(obfuscatedAccountId({ externalAccountIdentifiers: {} })).toBeNull();
  });

  it("isAcknowledged", () => {
    expect(isAcknowledged(purchase())).toBe(true);
    expect(isAcknowledged(purchase({ acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING" }))).toBe(false);
    expect(isAcknowledged({})).toBe(false);
  });

  it("isAllowedPlayProduct rejette un produit inconnu / vide", () => {
    const allowed = ["cardamome_plus"];
    expect(isAllowedPlayProduct("cardamome_plus", allowed)).toBe(true);
    expect(isAllowedPlayProduct("hacker_product", allowed)).toBe(false);
    expect(isAllowedPlayProduct(null, allowed)).toBe(false);
    expect(isAllowedPlayProduct(undefined, allowed)).toBe(false);
  });
});

describe("parseRtdnEnvelope", () => {
  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj), "utf8").toString("base64");

  it("parse une notification d'abonnement", () => {
    const data = encode({ version: "1.0", packageName: "studio.cardamome", subscriptionNotification: { version: "1.0", notificationType: RTDN_SUBSCRIPTION_TYPE.RENEWED, purchaseToken: "tok_1", subscriptionId: "cardamome_plus" } });
    expect(parseRtdnEnvelope(data)).toEqual({ kind: "subscription", purchaseToken: "tok_1", subscriptionId: "cardamome_plus", notificationType: 2 });
  });

  it("parse une notification d'achat annulé (voided)", () => {
    const data = encode({ voidedPurchaseNotification: { purchaseToken: "tok_2", orderId: "GPA.123" } });
    expect(parseRtdnEnvelope(data)).toEqual({ kind: "voided", purchaseToken: "tok_2" });
  });

  it("parse une notification de test", () => {
    expect(parseRtdnEnvelope(encode({ testNotification: { version: "1.0" } }))).toEqual({ kind: "test" });
  });

  it("rejette un base64 invalide, un JSON invalide, un objet vide", () => {
    expect(parseRtdnEnvelope("!!!not-base64!!!")).toBeNull();
    expect(parseRtdnEnvelope(Buffer.from("pas du json", "utf8").toString("base64"))).toBeNull();
    expect(parseRtdnEnvelope(encode({}))).toBeNull();
    expect(parseRtdnEnvelope("")).toBeNull();
    expect(parseRtdnEnvelope(null)).toBeNull();
    expect(parseRtdnEnvelope(undefined)).toBeNull();
  });

  it("rejette une notification d'abonnement incomplète (champ manquant / mauvais type)", () => {
    expect(parseRtdnEnvelope(encode({ subscriptionNotification: { purchaseToken: "tok", subscriptionId: "x" } }))).toBeNull(); // pas de notificationType
    expect(parseRtdnEnvelope(encode({ subscriptionNotification: { notificationType: 2, subscriptionId: "x" } }))).toBeNull(); // pas de token
    expect(parseRtdnEnvelope(encode({ subscriptionNotification: { notificationType: "2", purchaseToken: "tok", subscriptionId: "x" } }))).toBeNull(); // type non numérique
  });
});
