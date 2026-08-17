import { describe, it, expect } from "vitest";
import { isCancelledSignIn } from "@/lib/firebase/authErrors.js";

describe("isCancelledSignIn", () => {
  it("reconnaît les annulations Firebase (web)", () => {
    expect(isCancelledSignIn({ code: "auth/popup-closed-by-user" })).toBe(true);
    expect(isCancelledSignIn({ code: "auth/cancelled-popup-request" })).toBe(true);
    expect(isCancelledSignIn({ code: "auth/user-cancelled" })).toBe(true);
  });

  it("reconnaît une annulation native via le message (sans code standard)", () => {
    expect(isCancelledSignIn(new Error("The user canceled the sign-in flow."))).toBe(true);
    expect(isCancelledSignIn({ message: "Connexion annulée" })).toBe(true);
  });

  it("ne confond pas un vrai échec avec une annulation", () => {
    expect(isCancelledSignIn({ code: "auth/network-request-failed" })).toBe(false);
    expect(isCancelledSignIn(new Error("Jeton Google absent lors de la connexion native."))).toBe(false);
  });

  it("tolère null / undefined / formes inattendues", () => {
    expect(isCancelledSignIn(null)).toBe(false);
    expect(isCancelledSignIn(undefined)).toBe(false);
    expect(isCancelledSignIn("boom")).toBe(false);
    expect(isCancelledSignIn({})).toBe(false);
  });
});
