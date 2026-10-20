import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { auditHoverRules, parseCssRules, selectorMembers } from "../hoverRules.js";

// Lecture disque (et non `import.meta.glob` + `?raw`) : Vitest vide le contenu des
// CSS par défaut, ce qui ferait passer ces contrôles à vide.
const dir = join(process.cwd(), "src/styles");
const sheets = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(join(dir, f), "utf8")]);

describe("feuilles de l'app", () => {
  it("les feuilles sont lues et non vides", () => {
    const registry = sheets.find(([name]) => name === "interactions.css");
    expect(registry?.[1].length).toBeGreaterThan(0);
  });

  it.each(sheets)("%s respecte le contrat de survol", (file, css) => {
    const violations = auditHoverRules(css)
      .map((v) => `${file}:${v.line} ${v.kind} ${v.selector}${v.detail ? ` (${v.detail})` : ""}`);
    expect(violations).toEqual([]);
  });

  it("registre : tout membre d'une teinte ou du liseré est inscrit au voile", () => {
    const registry = sheets.find(([name]) => name === "interactions.css")?.[1] ?? "";
    const rules = parseCssRules(registry).filter((r) => r.selector.startsWith(":where("));
    const veil = rules.find((r) => r.body.includes("--veil-on: 0") && r.body.includes("isolation"));
    const enrolled = new Set([...selectorMembers(veil?.selector ?? ""), ".hover-ring", ".hover-text"]);
    // Un membre peut raffiner un inscrit par un état ou une variante :
    // `.filter-chip[data-on]`, `.btn-ghost.btn-ghost-plain`.
    const isEnrolled = (m) => [...enrolled].some((e) => m === e || (m.startsWith(e) && /^[[:.]/.test(m.slice(e.length))));
    const strays = rules.filter((r) => r !== veil)
      .flatMap((r) => selectorMembers(r.selector)).filter((m) => !isEnrolled(m));
    expect(veil).toBeDefined();
    expect(strays).toEqual([]);
  });
});
