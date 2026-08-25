import { describe, it, expect } from "vitest";
import { signInFeedback, SIGN_IN_LOADING_MESSAGE } from "@/lib/firebase/signInFeedback.js";

describe("signInFeedback", () => {
  it("succès : confirmation chaleureuse, ton ok", () => {
    expect(signInFeedback({ status: "success" })).toEqual({ tone: "ok", message: "Atelier retrouvé." });
  });

  it("annulation : message d'invitation, ton info", () => {
    expect(signInFeedback({ status: "cancelled" })).toEqual({
      tone: "info",
      message: "Connexion annulée. Ton atelier t'attend ici.",
    });
  });

  it("redirection en cours : rien à afficher (la page va basculer)", () => {
    expect(signInFeedback({ status: "redirect" })).toBeNull();
  });

  it("erreur réseau : message dédié réessai, ton error", () => {
    expect(signInFeedback({ status: "error", reason: "network" })).toEqual({
      tone: "error",
      message: "Impossible de joindre Google pour le moment. Vérifie ta connexion puis réessaie.",
    });
  });

  it("erreurs config et génériques partagent le message d'indisponibilité", () => {
    const generic = {
      tone: "error",
      message: "La connexion est momentanément indisponible. Réessaie un peu plus tard.",
    };
    expect(signInFeedback({ status: "error", reason: "config" })).toEqual(generic);
    expect(signInFeedback({ status: "error", reason: "generic" })).toEqual(generic);
  });

  it("compte non autorisé : message spécifique, ton error", () => {
    expect(signInFeedback({ status: "error", reason: "unauthorized" })).toEqual({
      tone: "error",
      message: "Ce compte n'est pas autorisé à rejoindre cet atelier.",
    });
  });

  it("expose le message de chargement", () => {
    expect(SIGN_IN_LOADING_MESSAGE).toBe("Ouverture de Google…");
  });
});
