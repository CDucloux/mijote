import { parse as parseYaml } from "yaml";
import { parseChefs } from "@/lib/recipes/chefs.js";
import raw from "../../data/chefs.yaml?raw";

// ─── CHEFS ────────────────────────────────────────────────────────────────────
// Liste fermée du champ « Chef » de l'éditeur, éditée dans data/chefs.yaml et
// embarquée à la compilation.

export const CHEFS = parseChefs(parseYaml(raw));
