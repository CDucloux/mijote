import { parse as parseYaml } from "yaml";
import { sanitizeSources } from "@/lib/sources/recommendedSources.js";
import raw from "../../data/sources.yaml?raw";

// ─── SOURCES RECOMMANDÉES PAR DÉFAUT ────────────────────────────────────────
// Repli affiché tant que la collection `master/sources` n'a pas été configurée
// dans la console admin (data/sources.yaml). L'admin peut tout remplacer / compléter.

/** @type {import("@/lib/sources/recommendedSources.js").RecommendedSource[]} */
export const DEFAULT_SOURCES = sanitizeSources(parseYaml(raw)?.sources);
