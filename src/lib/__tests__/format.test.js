import { describe, it, expect } from "vitest";
import { fmtTime, relativeDate, fmtQty, fmtQtyUnit, pluralizeName, stripAiDashes, allowsFractionGlyph } from "../format.js";

const EM_DASH = "\u2014";
const EN_DASH = "\u2013";

describe("fmtQty", () => {
  it("garde les entiers", () => { expect(fmtQty(1)).toBe("1"); expect(fmtQty(3)).toBe("3"); });
  it("convertit les fractions courantes en glyphes", () => {
    expect(fmtQty(0.5)).toBe("½");
    expect(fmtQty(0.25)).toBe("¼");
    expect(fmtQty(0.75)).toBe("¾");
    expect(fmtQty(1 / 3)).toBe("⅓");
  });
  it("préfixe la partie entière (« 1 ½ »)", () => {
    expect(fmtQty(1.5)).toBe("1 ½");
    expect(fmtQty(2.25)).toBe("2 ¼");
  });
  it("suit la mise à l'échelle des portions", () => {
    expect(fmtQty(0.5 * 2)).toBe("1");   // ½ × 2 → 1
    expect(fmtQty(0.5 * 3)).toBe("1 ½"); // ½ × 3 → 1 ½
  });
  it("décimal court à la française sinon", () => { expect(fmtQty(0.9)).toBe("0,9"); });
  it("gère vide/invalide", () => { expect(fmtQty("")).toBe(""); expect(fmtQty(null)).toBe(""); });
  it("bannit les fractions pour les unités métriques (décimal à la place)", () => {
    expect(fmtQty(0.5, "g")).toBe("0,5");
    expect(fmtQty(0.5, "kg")).toBe("0,5");
    expect(fmtQty(0.25, "ml")).toBe("0,25");
    expect(fmtQty(250.5, "g")).toBe("250,5");
    expect(fmtQty(1.5, "l")).toBe("1,5");
    expect(fmtQty(1.5, "cl")).toBe("1,5");
  });
  it("garde les fractions pour les unités discrètes et sans unité", () => {
    expect(fmtQty(0.5, "gousse")).toBe("½");
    expect(fmtQty(0.5, "cuillère à café")).toBe("½");
    expect(fmtQty(1.5, "cuillère à soupe")).toBe("1 ½");
    expect(fmtQty(0.5, "")).toBe("½");
    expect(fmtQty(0.5, undefined)).toBe("½");
  });
  it("garde les entiers même en unité métrique", () => {
    expect(fmtQty(250, "g")).toBe("250");
    expect(fmtQty(2, "kg")).toBe("2");
  });
});

describe("allowsFractionGlyph", () => {
  it("refuse les mesures métriques continues", () => {
    for (const u of ["g", "kg", "mg", "ml", "cl", "dl", "l"]) expect(allowsFractionGlyph(u)).toBe(false);
  });
  it("insensible à la casse et aux espaces", () => {
    expect(allowsFractionGlyph(" G ")).toBe(false);
    expect(allowsFractionGlyph("ML")).toBe(false);
  });
  it("autorise les unités discrètes et l'absence d'unité", () => {
    for (const u of ["gousse", "cuillère à café", "cuillère à soupe", "tranche", "pièce", "", null, undefined]) {
      expect(allowsFractionGlyph(u)).toBe(true);
    }
  });
});

describe("fmtQtyUnit", () => {
  it("colle les grammes, décolle le reste", () => {
    expect(fmtQtyUnit(50, "g")).toBe("50g");
    expect(fmtQtyUnit(2, "kg")).toBe("2kg");
    expect(fmtQtyUnit(1, "gousse")).toBe("1 gousse");
    expect(fmtQtyUnit(20, "ml")).toBe("20 ml");
    expect(fmtQtyUnit(0.5, "cuillère à café")).toBe("½ cuillère à café");
  });
  it("sans unité → quantité seule", () => { expect(fmtQtyUnit(0.5, "")).toBe("½"); });
  it("décimal (pas de fraction) pour les mesures métriques", () => {
    expect(fmtQtyUnit(0.5, "g")).toBe("0,5g");
    expect(fmtQtyUnit(0.5, "kg")).toBe("0,5kg");
    expect(fmtQtyUnit(2.5, "ml")).toBe("2,5 ml");
    expect(fmtQtyUnit(0.5, "cuillère à café")).toBe("½ cuillère à café"); // discrète → fraction
  });
  it("accorde l'unité comptable au pluriel dès 2", () => {
    expect(fmtQtyUnit(4, "gousse")).toBe("4 gousses");
    expect(fmtQtyUnit(2, "cuillère à soupe")).toBe("2 cuillères à soupe");
    expect(fmtQtyUnit(1, "gousse")).toBe("1 gousse");            // singulier < 2
    expect(fmtQtyUnit(1.5, "pièce")).toBe("1 ½ pièce");          // singulier < 2 (fraction affichée)
    expect(fmtQtyUnit(3, "g")).toBe("3g");                        // abréviations invariables
  });
});

describe("pluralizeName", () => {
  it("accorde le nom dès 2 (règles régulières)", () => {
    expect(pluralizeName(2, "oignon")).toBe("oignons");
    expect(pluralizeName(4, "œuf")).toBe("œufs");
    expect(pluralizeName(3, "tomate")).toBe("tomates");
  });
  it("gère les pluriels en -x (-au/-eau/-eu, -ou exceptions, -al)", () => {
    expect(pluralizeName(3, "poireau")).toBe("poireaux");
    expect(pluralizeName(2, "chou")).toBe("choux");
    expect(pluralizeName(2, "navet")).toBe("navets");
    expect(pluralizeName(2, "cheval")).toBe("chevaux");
  });
  it("n'accorde que le mot de tête (compléments invariables)", () => {
    expect(pluralizeName(2, "pomme de terre")).toBe("pommes de terre");
    expect(pluralizeName(3, "blanc de poulet")).toBe("blancs de poulet");
  });
  it("reste au singulier sous 2, et laisse les -s/-x/-z invariables", () => {
    expect(pluralizeName(1, "oignon")).toBe("oignon");
    expect(pluralizeName(0.5, "citron")).toBe("citron");
    expect(pluralizeName(3, "ananas")).toBe("ananas");
  });
  it("gère vide/invalide", () => {
    expect(pluralizeName(2, "")).toBe("");
    expect(pluralizeName(2, null)).toBe("");
  });
});

describe("fmtTime", () => {
  it("renders an em dash for null/undefined", () => {
    expect(fmtTime(null)).toBe("–");
    expect(fmtTime(undefined)).toBe("–");
  });

  it("keeps 0 as a real value (0m), not a dash", () => {
    expect(fmtTime(0)).toBe("0m");
  });

  it("renders minutes under an hour", () => {
    expect(fmtTime(5)).toBe("5m");
    expect(fmtTime(59)).toBe("59m");
  });

  it("renders whole hours without minutes", () => {
    expect(fmtTime(60)).toBe("1h");
    expect(fmtTime(120)).toBe("2h");
  });

  it("zero-pads the minutes part of an h+m time", () => {
    expect(fmtTime(65)).toBe("1h05");
    expect(fmtTime(90)).toBe("1h30");
    expect(fmtTime(125)).toBe("2h05");
  });
});

describe("relativeDate", () => {
  const now = new Date("2026-06-28T12:00:00Z").getTime();
  const ago = (days) => now - days * 86400000;

  it("returns '' for missing/invalid timestamps", () => {
    expect(relativeDate(null, now)).toBe("");
    expect(relativeDate(undefined, now)).toBe("");
    expect(relativeDate("nope", now)).toBe("");
  });
  it("says aujourd'hui for today (or future)", () => {
    expect(relativeDate(now, now)).toBe("aujourd'hui");
    expect(relativeDate(ago(0.4), now)).toBe("aujourd'hui");
    expect(relativeDate(now + 5000, now)).toBe("aujourd'hui");
  });
  it("counts days with plural agreement", () => {
    expect(relativeDate(ago(1), now)).toBe("il y a 1 jour");
    expect(relativeDate(ago(2), now)).toBe("il y a 2 jours");
    expect(relativeDate(ago(6), now)).toBe("il y a 6 jours");
  });
  it("counts weeks", () => {
    expect(relativeDate(ago(7), now)).toBe("il y a 1 semaine");
    expect(relativeDate(ago(20), now)).toBe("il y a 2 semaines");
  });
  it("counts months (invariable)", () => {
    expect(relativeDate(ago(30), now)).toBe("il y a 1 mois");
    expect(relativeDate(ago(90), now)).toBe("il y a 3 mois");
  });
  it("counts years with plural agreement", () => {
    expect(relativeDate(ago(365), now)).toBe("il y a 1 an");
    expect(relativeDate(ago(365 * 3), now)).toBe("il y a 3 ans");
  });
});

describe("stripAiDashes", () => {
  it("replaces an em dash aside with a comma", () => {
    expect(stripAiDashes(`Faire revenir l'oignon ${EM_DASH} feu doux ${EM_DASH} puis ajouter l'ail`))
      .toBe("Faire revenir l'oignon, feu doux, puis ajouter l'ail");
  });
  it("collapses the double space and space-before-comma left by the removed dash", () => {
    expect(stripAiDashes(`Laisser mijoter ${EM_DASH} à couvert.`)).toBe("Laisser mijoter, à couvert.");
  });
  it("leaves text without an em dash untouched", () => {
    expect(stripAiDashes("Émincer les oignons, puis les faire suer.")).toBe("Émincer les oignons, puis les faire suer.");
  });
  it("preserves simple hyphens and en dashes (ranges, compound words)", () => {
    expect(stripAiDashes(`Cuire 10${EN_DASH}12 min en sous-vide.`)).toBe(`Cuire 10${EN_DASH}12 min en sous-vide.`);
  });
  it("handles empty/null/undefined", () => {
    expect(stripAiDashes("")).toBe("");
    expect(stripAiDashes(null)).toBe("");
    expect(stripAiDashes(undefined)).toBe("");
  });
});
