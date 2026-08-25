import { describe, it, expect } from "vitest";
import { isCancelledSignIn, classifySignInError } from "@/lib/firebase/authErrors.js";

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

describe("classifySignInError", () => {
  it("détecte les défauts réseau (code ou message)", () => {
    expect(classifySignInError({ code: "auth/network-request-failed" })).toBe("network");
    expect(classifySignInError({ code: "auth/timeout" })).toBe("network");
    expect(classifySignInError(new Error("Network error while contacting Google"))).toBe("network");
    expect(classifySignInError({ message: "Appareil hors ligne" })).toBe("network");
  });

  it("détecte les défauts de configuration (projet Firebase / OAuth)", () => {
    expect(classifySignInError({ code: "auth/operation-not-allowed" })).toBe("config");
    expect(classifySignInError({ code: "auth/unauthorized-domain" })).toBe("config");
    expect(classifySignInError({ code: "auth/invalid-api-key" })).toBe("config");
    expect(classifySignInError({ code: "auth/configuration-not-found" })).toBe("config");
    expect(classifySignInError({ code: "auth/internal-error" })).toBe("config");
  });

  it("retombe sur generic pour un échec quelconque", () => {
    expect(classifySignInError(new Error("Jeton Google absent lors de la connexion native."))).toBe("generic");
    expect(classifySignInError({ code: "auth/some-new-code" })).toBe("generic");
    expect(classifySignInError(null)).toBe("generic");
    expect(classifySignInError(undefined)).toBe("generic");
    expect(classifySignInError("boom")).toBe("generic");
  });
});
