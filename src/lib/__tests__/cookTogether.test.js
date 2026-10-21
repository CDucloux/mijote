import { describe, it, expect } from "vitest";
import {
  PRESENCE_TTL_MS, AWAY_TTL_MS, pageKeyOf, parseCookSession, activeParticipants, isSessionLive,
  othersByPage, joinableSessions, firstNameOf, partnerPositions, cookPageLabel, companionText,
} from "../cookSession/together.js";

const NOW = 1_800_000_000_000;
const doc = (over = {}) => ({
  recipeId: "r1", recipeName: "Hachis", startedAt: NOW - 600_000, doneSteps: [2, 0, 2], finished: false,
  participants: {
    me: { name: "Corentin D", photoURL: "a.png", page: "step:1", lastSeen: NOW - 5_000 },
    her: { name: "Léa", photoURL: "", page: "step:3", lastSeen: NOW - 10_000 },
  },
  ...over,
});

describe("pageKeyOf", () => {
  it("clé stable par type de page", () => {
    expect(pageKeyOf({ kind: "overview" })).toBe("overview");
    expect(pageKeyOf({ kind: "bases" })).toBe("bases");
    expect(pageKeyOf({ kind: "step", realIdx: 4 })).toBe("step:4");
  });
});

describe("parseCookSession", () => {
  it("valide un document complet, dédoublonne et trie les étapes faites", () => {
    const s = parseCookSession(doc());
    expect(s.recipeId).toBe("r1");
    expect(s.doneSteps).toEqual([0, 2]);
    expect(s.participants.map(p => p.uid)).toEqual(["me", "her"]);
    expect(s.finishedBy).toBeNull();
  });

  it("donnée externe malformée → null ou champs neutres", () => {
    expect(parseCookSession(null)).toBeNull();
    expect(parseCookSession("x")).toBeNull();
    expect(parseCookSession({ recipeName: "sans id" })).toBeNull();
    const s = parseCookSession({ recipeId: "r", participants: "x", doneSteps: ["a", -1, 1.5, 3] });
    expect(s.participants).toEqual([]);
    expect(s.doneSteps).toEqual([3]);
    expect(s.startedAt).toBe(0);
    expect(s.finished).toBe(false);
  });

  it("ignore un participant sans page, lit un Timestamp Firestore", () => {
    const s = parseCookSession(doc({
      participants: { a: { name: "A" }, b: { name: "B", page: "overview", lastSeen: { toMillis: () => 42 } } },
      startedAt: { toMillis: () => 7 },
    }));
    expect(s.participants.map(p => [p.uid, p.lastSeen])).toEqual([["b", 42]]);
    expect(s.startedAt).toBe(7);
  });
});

describe("présence", () => {
  it("un participant sans battement depuis le TTL est parti", () => {
    const s = parseCookSession(doc({ participants: {
      on: { name: "On", page: "overview", lastSeen: NOW - PRESENCE_TTL_MS + 1 },
      off: { name: "Off", page: "overview", lastSeen: NOW - PRESENCE_TTL_MS },
    } }));
    expect(activeParticipants(s, NOW).map(p => p.uid)).toEqual(["on"]);
  });

  it("en veille : toléré bien au-delà du TTL, jusqu'à AWAY_TTL", () => {
    const s = parseCookSession(doc({ participants: {
      asleep: { name: "Léa", page: "step:2", away: true, lastSeen: NOW - PRESENCE_TTL_MS * 3 },
      gone: { name: "Ancien", page: "step:2", away: true, lastSeen: NOW - AWAY_TTL_MS },
    } }));
    expect(activeParticipants(s, NOW).map(p => p.uid)).toEqual(["asleep"]);
    expect(s.participants[0].away).toBe(true);
  });

  it("away absent ou non booléen : présent normal", () => {
    const s = parseCookSession(doc({ participants: { a: { name: "A", page: "overview", away: "yes", lastSeen: NOW } } }));
    expect(s.participants[0].away).toBe(false);
  });

  it("session vivante = non terminée avec au moins un présent", () => {
    expect(isSessionLive(parseCookSession(doc()), NOW)).toBe(true);
    expect(isSessionLive(parseCookSession(doc({ finished: true })), NOW)).toBe(false);
    expect(isSessionLive(parseCookSession(doc()), NOW + PRESENCE_TTL_MS + 20_000)).toBe(false);
    expect(isSessionLive(null, NOW)).toBe(false);
  });
});

describe("othersByPage", () => {
  it("regroupe les autres membres présents par page, sans soi", () => {
    const m = othersByPage(parseCookSession(doc()), "me", NOW);
    expect([...m.keys()]).toEqual(["step:3"]);
    expect(m.get("step:3")[0].name).toBe("Léa");
  });

  it("session absente → aucune position", () => {
    expect(othersByPage(null, "me", NOW).size).toBe(0);
  });
});

describe("joinableSessions", () => {
  const live = parseCookSession(doc({ participants: { her: { name: "Léa", page: "overview", lastSeen: NOW } } }));
  it("propose une session où l'autre cuisine et où je ne suis pas", () => {
    expect(joinableSessions([live], "me", NOW)).toHaveLength(1);
  });

  it("exclut : déjà dedans, terminée, seul, ou binôme parti", () => {
    const withMe = parseCookSession(doc());
    const finished = parseCookSession(doc({ finished: true, participants: { her: { name: "Léa", page: "overview", lastSeen: NOW } } }));
    const alone = parseCookSession(doc({ participants: { me: { name: "C", page: "overview", lastSeen: NOW } } }));
    expect(joinableSessions([withMe, finished, alone], "me", NOW)).toEqual([]);
    expect(joinableSessions([live], "me", NOW + PRESENCE_TTL_MS + 1)).toEqual([]);
  });

  it("les plus récentes d'abord", () => {
    const older = { ...live, recipeId: "old", startedAt: 1 };
    expect(joinableSessions([older, live], "me", NOW).map(s => s.recipeId)).toEqual(["r1", "old"]);
  });
});

describe("firstNameOf", () => {
  it("premier mot du nom, repli si vide", () => {
    expect(firstNameOf({ name: "  Léa Martin " })).toBe("Léa");
    expect(firstNameOf({ name: "" })).toBe("Ton binôme");
  });
});

describe("partnerPositions", () => {
  const others = othersByPage(parseCookSession(doc()), "me", NOW);
  it("situe chaque autre membre par l'index de sa page", () => {
    const pos = partnerPositions(["overview", "step:0", "step:1", "step:2", "step:3"], others);
    expect(pos.map(p => [p.participant.uid, p.index])).toEqual([["her", 4]]);
  });

  it("page inconnue de cet appareil : ignorée", () => {
    expect(partnerPositions(["overview", "step:0"], others)).toEqual([]);
  });
});

describe("cookPageLabel", () => {
  it("libellé par type de page, étapes numérotées depuis 1", () => {
    expect(cookPageLabel({ kind: "overview" })).toBe("Mise en place");
    expect(cookPageLabel({ kind: "bases" })).toBe("Bases");
    expect(cookPageLabel({ kind: "step", realIdx: 0 })).toBe("Étape 1");
  });
});

describe("companionText", () => {
  it("prénom et page, suffixe quand l'écran est en veille", () => {
    expect(companionText({ name: "Léa Martin", away: false }, "Étape 4")).toBe("Léa : étape 4");
    expect(companionText({ name: "Léa", away: true }, "Mise en place")).toBe("Léa : mise en place (écran en veille)");
  });
});
