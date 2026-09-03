// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ELASTIC_SELECTOR,
  elasticContentOf,
  elasticOptionsFrom,
  installGlobalElasticScroll,
} from "@/lib/ui/globalElasticScroll.js";

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** Stub matchMedia : coarse => (hover: none) vrai ; reduce toujours faux. */
function mockPointer(coarse) {
  vi.stubGlobal("matchMedia", (q) => ({
    matches: q.includes("hover: none") ? coarse : false,
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

describe("ELASTIC_SELECTOR", () => {
  it("cible l'attribut d'opt-in", () => {
    expect(ELASTIC_SELECTOR).toBe("[data-elastic-scroll]");
  });
});

describe("elasticContentOf", () => {
  it("préfère l'enfant direct marqué data-elastic-content", () => {
    document.body.innerHTML = `<div data-elastic-scroll><span id="a">x</span><div data-elastic-content id="b">y</div></div>`;
    const c = document.querySelector("[data-elastic-scroll]");
    expect(elasticContentOf(c)).toBe(document.getElementById("b"));
  });

  it("retombe sur le premier enfant élément sans marqueur", () => {
    document.body.innerHTML = `<div data-elastic-scroll><section id="w">contenu</section></div>`;
    const c = document.querySelector("[data-elastic-scroll]");
    expect(elasticContentOf(c)).toBe(document.getElementById("w"));
  });

  it("ne prend PAS un data-elastic-content non direct (petit-enfant)", () => {
    document.body.innerHTML = `<div data-elastic-scroll><div id="wrap"><div data-elastic-content id="deep">y</div></div></div>`;
    const c = document.querySelector("[data-elastic-scroll]");
    expect(elasticContentOf(c)).toBe(document.getElementById("wrap")); // fallback firstElementChild
  });

  it("retourne null sans aucun enfant élément", () => {
    document.body.innerHTML = `<div data-elastic-scroll>  texte seul  </div>`;
    const c = document.querySelector("[data-elastic-scroll]");
    expect(elasticContentOf(c)).toBeNull();
  });
});

describe("elasticOptionsFrom", () => {
  it("lit data-elastic-max quand c'est un nombre fini", () => {
    document.body.innerHTML = `<div data-elastic-scroll data-elastic-max="64"></div>`;
    expect(elasticOptionsFrom(document.querySelector("[data-elastic-scroll]")).max).toBe(64);
  });

  it("laisse max indéfini (défaut du coeur) si absent ou non numérique", () => {
    document.body.innerHTML = `<div data-elastic-scroll data-elastic-max="abc"></div>`;
    expect(elasticOptionsFrom(document.querySelector("[data-elastic-scroll]")).max).toBeUndefined();
    document.body.innerHTML = `<div data-elastic-scroll></div>`;
    expect(elasticOptionsFrom(document.querySelector("[data-elastic-scroll]")).max).toBeUndefined();
  });

  it("active armWhenUnscrollable par la seule présence de l'attribut", () => {
    document.body.innerHTML = `<div data-elastic-scroll data-elastic-arm-unscrollable></div>`;
    expect(elasticOptionsFrom(document.querySelector("[data-elastic-scroll]")).armWhenUnscrollable).toBe(true);
    document.body.innerHTML = `<div data-elastic-scroll></div>`;
    expect(elasticOptionsFrom(document.querySelector("[data-elastic-scroll]")).armWhenUnscrollable).toBe(false);
  });
});

describe("installGlobalElasticScroll", () => {
  it("ne fait rien sur pointeur fin (souris) et rend un nettoyage inerte", () => {
    mockPointer(false); // souris
    document.body.innerHTML = `<div data-elastic-scroll><div>contenu</div></div>`;
    const el = document.querySelector("[data-elastic-scroll]");
    const add = vi.spyOn(el, "addEventListener");
    const off = installGlobalElasticScroll();
    expect(add).not.toHaveBeenCalled();
    expect(() => off()).not.toThrow();
  });

  it("attache l'effet aux conteneurs marqués présents (tactile), détache au nettoyage", () => {
    mockPointer(true); // tactile
    document.body.innerHTML = `<div data-elastic-scroll><div>contenu</div></div>`;
    const el = document.querySelector("[data-elastic-scroll]");
    const add = vi.spyOn(el, "addEventListener");
    const remove = vi.spyOn(el, "removeEventListener");
    const off = installGlobalElasticScroll();
    expect(add.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(["touchstart", "scroll"]));
    off();
    expect(remove.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(["touchstart", "scroll"]));
  });

  it("attache un conteneur ajouté APRÈS l'installation (navigation entre pages)", async () => {
    mockPointer(true);
    const off = installGlobalElasticScroll();
    const page = document.createElement("div");
    page.setAttribute("data-elastic-scroll", "");
    page.innerHTML = `<div>corps de page</div>`;
    const add = vi.spyOn(page, "addEventListener");
    document.body.appendChild(page);
    await new Promise((r) => setTimeout(r, 0)); // laisse le MutationObserver livrer
    expect(add.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining(["touchstart"]));
    off();
  });

  it("n'attache pas un conteneur marqué mais vide (aucun enfant à transformer)", () => {
    mockPointer(true);
    document.body.innerHTML = `<div data-elastic-scroll>   </div>`;
    const el = document.querySelector("[data-elastic-scroll]");
    const add = vi.spyOn(el, "addEventListener");
    const off = installGlobalElasticScroll();
    expect(add).not.toHaveBeenCalled();
    off();
  });
});
