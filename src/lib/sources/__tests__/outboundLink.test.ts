import { describe, it, expect } from "vitest";
import {
  OUTBOUND_REF, normalizeSourceUrl, outboundSourceHref, sourceHost, clickMonth, sourceClickKey, clicksForSource,
} from "@/lib/sources/outboundLink.js";

describe("normalizeSourceUrl", () => {
  it("ajoute https:// à une source saisie sans schéma", () => {
    expect(normalizeSourceUrl("www.cestmafournee.com/tarte")).toBe("https://www.cestmafournee.com/tarte");
  });
  it("garde une URL http(s) complète", () => {
    expect(normalizeSourceUrl("http://site.fr/a?b=1")).toBe("http://site.fr/a?b=1");
  });
  it("renvoie null pour une source vide, absente ou non web", () => {
    expect(normalizeSourceUrl("")).toBeNull();
    expect(normalizeSourceUrl("   ")).toBeNull();
    expect(normalizeSourceUrl(null)).toBeNull();
    expect(normalizeSourceUrl(undefined)).toBeNull();
    expect(normalizeSourceUrl("Livre de mamie")).toBeNull();
  });
});

describe("outboundSourceHref", () => {
  it("ajoute ref=cardamome", () => {
    expect(outboundSourceHref("https://site.fr/recette")).toBe(`https://site.fr/recette?ref=${OUTBOUND_REF}`);
  });
  it("conserve la query existante et l'ancre", () => {
    const href = outboundSourceHref("https://site.fr/r?id=4#etapes");
    const url = new URL(href!);
    expect(url.searchParams.get("id")).toBe("4");
    expect(url.searchParams.get("ref")).toBe(OUTBOUND_REF);
    expect(url.hash).toBe("#etapes");
  });
  it("n'écrase pas un ref déjà présent", () => {
    expect(outboundSourceHref("https://site.fr/r?ref=insta")).toBe("https://site.fr/r?ref=insta");
  });
  it("renvoie null pour une source non web", () => {
    expect(outboundSourceHref("Livre de mamie")).toBeNull();
    expect(outboundSourceHref(undefined)).toBeNull();
  });
});

describe("sourceHost", () => {
  it("retire www. et met en minuscules", () => {
    expect(sourceHost("https://WWW.CestMaFournee.com/x")).toBe("cestmafournee.com");
  });
  it("replie sur le texte brut quand la source n'est pas une URL", () => {
    expect(sourceHost("Livre de mamie")).toBe("Livre de mamie");
    expect(sourceHost("")).toBe("");
    expect(sourceHost(null)).toBe("");
  });
});

describe("clickMonth / sourceClickKey", () => {
  const date = new Date("2026-10-31T23:30:00Z");
  it("formate le mois en UTC", () => {
    expect(clickMonth(date)).toBe("2026-10");
  });
  it("compose domaine__mois, identique avec ou sans www ni chemin", () => {
    expect(sourceClickKey("https://www.cuisinealagrecque.fr/moussaka", date)).toBe("cuisinealagrecque.fr__2026-10");
    expect(sourceClickKey("cuisinealagrecque.fr", date)).toBe("cuisinealagrecque.fr__2026-10");
  });
  it("renvoie null pour une source non web", () => {
    expect(sourceClickKey("Livre de mamie", date)).toBeNull();
    expect(sourceClickKey("", date)).toBeNull();
  });
});

describe("clicksForSource", () => {
  const counts = [
    { host: "cestmafournee.com", count: 12 },
    { host: "cuisinealagrecque.fr", count: 3 },
  ];
  it("retrouve les clics du domaine de la source, www ou chemin compris", () => {
    expect(clicksForSource(counts, "https://www.cestmafournee.com/")).toBe(12);
    expect(clicksForSource(counts, "cuisinealagrecque.fr/blog")).toBe(3);
  });
  it("vaut 0 sans compteur, sans données, ou pour une URL non web", () => {
    expect(clicksForSource(counts, "https://autre.fr")).toBe(0);
    expect(clicksForSource([], "https://cestmafournee.com")).toBe(0);
    expect(clicksForSource(counts, "")).toBe(0);
  });
});
