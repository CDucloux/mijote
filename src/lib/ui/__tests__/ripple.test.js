// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { RIPPLE_SELECTOR, rippleTargetFrom, spawnRipple } from "@/lib/ui/ripple.js";

afterEach(() => { document.body.innerHTML = ""; });

describe("RIPPLE_SELECTOR", () => {
  it("cible l'opt-in explicite, les boutons et les pilules", () => {
    expect(RIPPLE_SELECTOR).toContain(".ripple");
    expect(RIPPLE_SELECTOR).toContain(".btn");
    expect(RIPPLE_SELECTOR).toContain(".pressable");
  });
});

describe("rippleTargetFrom", () => {
  it("retrouve la surface .btn depuis un enfant du point de contact", () => {
    document.body.innerHTML = `<button class="btn"><span id="ic">icone</span> Ajouter</button>`;
    const child = document.getElementById("ic");
    const el = rippleTargetFrom(child);
    expect(el).toBe(document.querySelector("button.btn"));
  });

  it("retrouve une pilule .pressable (généralisation)", () => {
    document.body.innerHTML = `<button class="pressable">Vegan</button>`;
    const btn = document.querySelector(".pressable");
    expect(rippleTargetFrom(btn)).toBe(btn);
  });

  it("retrouve l'opt-in .ripple existant", () => {
    document.body.innerHTML = `<div class="ripple"><i id="c">x</i></div>`;
    expect(rippleTargetFrom(document.getElementById("c"))).toBe(document.querySelector(".ripple"));
  });

  it("remonte à la surface éligible la plus proche", () => {
    document.body.innerHTML = `<div class="ripple"><button class="btn"><span id="d">go</span></button></div>`;
    expect(rippleTargetFrom(document.getElementById("d"))).toBe(document.querySelector("button.btn"));
  });

  it("retourne null hors de toute surface éligible", () => {
    document.body.innerHTML = `<div><span id="p">rien</span></div>`;
    expect(rippleTargetFrom(document.getElementById("p"))).toBeNull();
  });

  it("retourne null pour une cible nulle ou non-Element", () => {
    expect(rippleTargetFrom(null)).toBeNull();
    expect(rippleTargetFrom(document)).toBeNull();
  });
});

describe("spawnRipple", () => {
  it("insère l'onde en premier enfant (sous le contenu), dimensionnée et positionnée", () => {
    document.body.innerHTML = `<button class="btn">Ajouter</button>`;
    const btn = document.querySelector("button");
    // jsdom ne fait pas de layout : getBoundingClientRect renvoie des 0, l'onde vaut 0px.
    spawnRipple({ currentTarget: btn, clientX: 5, clientY: 5 });
    const ink = btn.firstChild;
    expect(ink).not.toBeNull();
    expect(ink.classList.contains("ripple-ink")).toBe(true);
    expect(ink).toBe(btn.firstChild); // posée AVANT le texte
    expect(ink.style.width).toBe("0px");
  });

  it("ne fait rien sans cible", () => {
    expect(() => spawnRipple({ currentTarget: null })).not.toThrow();
  });
});
