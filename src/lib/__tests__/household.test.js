import { describe, it, expect } from "vitest";
import {
  MAX_HOUSEHOLD, peopleCount, isOwner, isMemberUid, newHouseholdDoc,
  canInvite, withInvite, withInviteRemoved, withAcceptedMember, withMemberRemoved,
  planHouseholdExit,
} from "@/lib/household/household.js";

const owner = { uid: "u1", email: "Owner@Mail.com" };

describe("newHouseholdDoc", () => {
  it("crée un foyer avec le créateur comme owner & membre, email normalisé", () => {
    const h = newHouseholdDoc({ id: "h1", owner, name: "  Maison  " });
    expect(h.ownerUid).toBe("u1");
    expect(h.memberUids).toEqual(["u1"]);
    expect(h.memberEmails).toEqual(["owner@mail.com"]);
    expect(h.invitedEmails).toEqual([]);
    expect(h.name).toBe("Maison");
    expect(isOwner(h, "u1")).toBe(true);
    expect(isMemberUid(h, "u1")).toBe(true);
  });
  it("nom par défaut si vide", () => {
    expect(newHouseholdDoc({ id: "h1", owner, name: "" }).name).toBe("Mon foyer");
  });
});

describe("invitations & plafond", () => {
  const base = newHouseholdDoc({ id: "h1", owner });
  it("invite un email (normalisé) et compte la place", () => {
    const h = withInvite(base, "Bob@x.com");
    expect(h.invitedEmails).toEqual(["bob@x.com"]);
    expect(peopleCount(h)).toBe(2);
  });
  it("refuse les doublons (membre ou invité) et la casse", () => {
    expect(canInvite(base, "OWNER@mail.com")).toBe(false);
    const h = withInvite(base, "bob@x.com");
    expect(canInvite(h, "bob@x.com")).toBe(false);
  });
  it("plafonne à MAX_HOUSEHOLD places (membres + invités)", () => {
    let h = base; // owner = 1 place
    h = withInvite(h, "a@x.com"); // + 1 invité → plein à 2
    expect(peopleCount(h)).toBe(MAX_HOUSEHOLD);
    expect(canInvite(h, "b@x.com")).toBe(false);
    expect(withInvite(h, "b@x.com")).toBe(h); // inchangé
  });
  it("retire une invitation", () => {
    const h = withInviteRemoved(withInvite(base, "bob@x.com"), "BOB@x.com");
    expect(h.invitedEmails).toEqual([]);
  });
});

describe("adhésion & départ", () => {
  it("accepter : invité → membre, place inchangée", () => {
    const invited = withInvite(newHouseholdDoc({ id: "h1", owner }), "bob@x.com");
    expect(peopleCount(invited)).toBe(2);
    const h = withAcceptedMember(invited, { uid: "u2", email: "bob@x.com" });
    expect(h.memberUids).toEqual(["u1", "u2"]);
    expect(h.memberEmails).toEqual(["owner@mail.com", "bob@x.com"]);
    expect(h.invitedEmails).toEqual([]);
    expect(peopleCount(h)).toBe(2);
  });
  it("accepter est idempotent", () => {
    let h = withAcceptedMember(newHouseholdDoc({ id: "h1", owner }), { uid: "u1", email: "owner@mail.com" });
    expect(h.memberUids).toEqual(["u1"]);
  });
  it("retirer un membre", () => {
    let h = withAcceptedMember(withInvite(newHouseholdDoc({ id: "h1", owner }), "bob@x.com"), { uid: "u2", email: "bob@x.com" });
    h = withMemberRemoved(h, { uid: "u2", email: "bob@x.com" });
    expect(h.memberUids).toEqual(["u1"]);
    expect(h.memberEmails).toEqual(["owner@mail.com"]);
  });
});

describe("planHouseholdExit", () => {
  const user = { uid: "u1", email: "owner@mail.com" };

  it("supprime les foyers possédés et quitte les autres", () => {
    const docs = [
      { id: "a", ownerUid: "u1", memberUids: ["u1"], memberEmails: ["owner@mail.com"] },
      { id: "b", ownerUid: "u9", memberUids: ["u9", "u1"], memberEmails: ["x@y.z", "owner@mail.com"] },
    ];
    const plan = planHouseholdExit(docs, user);
    expect(plan.deleteIds).toEqual(["a"]);
    expect(plan.leave).toHaveLength(1);
    expect(plan.leave[0].id).toBe("b");
    expect(plan.leave[0].next.memberUids).toEqual(["u9"]);
    expect(plan.leave[0].next.memberEmails).toEqual(["x@y.z"]);
  });

  it("gère plusieurs foyers possédés (doublons fantômes) en une passe", () => {
    const docs = [
      { id: "a", ownerUid: "u1", memberUids: ["u1"] },
      { id: "b", ownerUid: "u1", memberUids: ["u1"] },
      { id: "c", ownerUid: "u1", memberUids: ["u1"] },
    ];
    expect(planHouseholdExit(docs, user).deleteIds).toEqual(["a", "b", "c"]);
    expect(planHouseholdExit(docs, user).leave).toEqual([]);
  });

  it("sur une liste vide, ne fait rien", () => {
    expect(planHouseholdExit([], user)).toEqual({ deleteIds: [], leave: [] });
  });
});
