import { describe, it, expect } from "vitest";
import { auditHoverRules, hardcodedColors, parseCssRules, selectorMembers, HOVER_GUARD } from "../hoverRules.js";

describe("parseCssRules", () => {
  it("chaîne vide → aucune règle", () => {
    expect(parseCssRules("")).toEqual([]);
  });

  it("garde les at-rules englobantes et des numéros de ligne justes malgré les commentaires", () => {
    const css = "/* a\n b */\n.x { color: red; }\n@media (hover: hover) {\n  .y:hover { color: blue; }\n}";
    const rules = parseCssRules(css);
    expect(rules.map((r) => [r.selector, r.line, r.atRules])).toEqual([
      [".x", 3, []],
      [".y:hover", 5, ["@media (hover: hover)"]],
    ]);
  });

  it("sélecteur multi-lignes : ligne de son début, espaces normalisés", () => {
    const [rule] = parseCssRules(".a:hover,\n.b:hover { color: red; }");
    expect(rule.selector).toBe(".a:hover, .b:hover");
    expect(rule.line).toBe(1);
  });

  it("ignore un @import en tête sans décaler le sélecteur suivant", () => {
    const [rule] = parseCssRules("@import url(x.css);\n.a { color: red; }");
    expect(rule.selector).toBe(".a");
  });

  it("règle imbriquée après des déclarations : sélecteur propre (non-régression)", () => {
    const rules = parseCssRules(".a {\n  color: red;\n  &::before { content: \"\"; }\n}");
    expect(rules.map((r) => r.selector)).toEqual([".a", "&::before"]);
  });

  it("CSS tronqué (accolade non fermée) : ne lève pas", () => {
    expect(() => parseCssRules(".a:hover { color: red;")).not.toThrow();
  });
});

describe("hardcodedColors", () => {
  it("noir et blanc purs admis, tokens admis", () => {
    expect(hardcodedColors("box-shadow: 0 2px 4px rgba(0, 0, 0, .2); color: #fff; background: rgba(var(--red-rgb), .1)")).toEqual([]);
  });

  it("teintes littérales signalées (rgba et hex)", () => {
    expect(hardcodedColors("background: rgba(224, 82, 82, 0.2); color: #f3f4ec")).toEqual(["rgba(224, 82, 82, 0.2)", "#f3f4ec"]);
  });
});

describe("auditHoverRules", () => {
  it("survol gardé, sans !important ni couleur en dur → conforme", () => {
    expect(auditHoverRules(`${HOVER_GUARD} { .a:hover { color: var(--text); } }`)).toEqual([]);
  });

  it("survol hors garde ou sous une garde incomplète → unguarded", () => {
    const css = ".a:hover { color: var(--text); }\n@media (hover: hover) { .b:hover { color: var(--text); } }";
    expect(auditHoverRules(css).map((v) => [v.kind, v.selector])).toEqual([
      ["unguarded", ".a:hover"],
      ["unguarded", ".b:hover"],
    ]);
  });

  it("garde tolérante aux espaces et à la casse d'écriture des deux-points", () => {
    expect(auditHoverRules("@media (hover:hover) and (pointer:fine) { .a:hover { color: var(--text); } }")).toEqual([]);
  });

  it("!important et couleur en dur signalés", () => {
    const css = `${HOVER_GUARD} { .a:hover { background: rgba(232, 146, 10, .2) !important; } }`;
    expect(auditHoverRules(css)).toEqual([
      { kind: "important", selector: ".a:hover", line: 1 },
      { kind: "hardcoded-color", selector: ".a:hover", line: 1, detail: "rgba(232, 146, 10, .2)" },
    ]);
  });

  it("règles sans :hover ignorées", () => {
    expect(auditHoverRules(".a { background: #abcdef !important; }")).toEqual([]);
  });
});

describe("selectorMembers", () => {
  it("déplie :where/:is et ne coupe pas les virgules imbriquées", () => {
    expect(selectorMembers(":where(.a, .b:not(.c, .d),\n .e [data-x=\"1,2\"])")).toEqual([".a", ".b:not(.c, .d)", '.e [data-x="1,2"]']);
  });

  it("liste nue et sélecteur simple", () => {
    expect(selectorMembers(".a, .b")).toEqual([".a", ".b"]);
    expect(selectorMembers(".a")).toEqual([".a"]);
  });

  it(":where non englobant (suivi d'autre chose) : pas déplié à tort", () => {
    expect(selectorMembers(":where(.a) .b, .c")).toEqual([":where(.a) .b", ".c"]);
  });

  it("chaîne vide → aucun membre", () => {
    expect(selectorMembers("")).toEqual([]);
  });
});
