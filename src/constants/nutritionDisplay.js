import { parse as parseYaml } from "yaml";
import { parseNutritionReferences } from "@/lib/data/referenceData.js";
import raw from "../../data/nutrition-references.yaml?raw";

// Repères nutritionnels journaliers (AJR adulte, base 2000 kcal, édités dans
// data/nutrition-references.yaml) pour situer chaque apport en % d'une journée type.
export const NUTRI_RI = parseNutritionReferences(parseYaml(raw));
export const MACRO_COLORS = { protein: "#5b8def", carbs: "#f0b429", fat: "#e8703a" };
