import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { mergeImport, importHeadline, importContext } from "@/lib/household/importMerge.js";
import type { ImportNoun, ImportReport } from "@/lib/household/importMerge.js";
import {
  parseIngredientsYaml, parseUtensilsYaml, parseTechniquesYaml,
  formatTechniquesMarkdown, formatTechniquesYaml, formatIngredientsYaml, formatUtensilsYaml,
} from "@/lib/household/dataYaml.js";
import { formatIngredientsMarkdown, formatUtensilsMarkdown } from "@/lib/food/ingredientsMarkdown.js";
import { sortedCategoryEntries } from "@/constants/categories.js";
import { exportTextFile } from "@/lib/ui/fileExport.js";
import { reportError } from "@/lib/observability/observability.js";
import type { IngredientDbItem, UtensilDbItem } from "@/lib/types.js";
import type { TechniqueEntry } from "@/lib/recipes/techniques.js";
import type { IngredientCategory } from "@/lib/data/referenceData.js";
import type { ImportResult } from "../components/admin/ImportResultDialog.jsx";

// Libellés des bilans d'import (titre « 3 ustensiles mis à jour », « 1 nouvel ingrédient »…).
const INGREDIENT_NOUN: ImportNoun = { one: "ingrédient", many: "ingrédients", newOne: "nouvel ingrédient", newMany: "nouveaux ingrédients" };
const UTENSIL_NOUN: ImportNoun = { one: "ustensile", many: "ustensiles", newOne: "nouvel ustensile", newMany: "nouveaux ustensiles" };
const TECHNIQUE_NOUN: ImportNoun = { one: "geste technique", many: "gestes techniques", newOne: "nouveau geste technique", newMany: "nouveaux gestes techniques" };

// Exporte un fichier texte généré : téléchargement sur le web, feuille de
// partage dans l'app native (la WebView Android ignore <a download>).
const downloadText = (filename: string, text: string, type: string) => {
  exportTextFile(filename, text, type).catch(e => reportError(e, { action: "export", filename }));
};

/** Actions d'import / export d'une base master, branchées sur `BaseMenu`. */
export interface BaseTransfer {
  onExportYaml: () => void;
  onExportMarkdown: () => void;
  onImportYaml: (text: string) => void;
}

interface MasterImportsArgs {
  ingredientDB: IngredientDbItem[];
  setIngredientDB: Dispatch<SetStateAction<IngredientDbItem[]>>;
  utensilDB: UtensilDbItem[];
  setUtensilDB: Dispatch<SetStateAction<UtensilDbItem[]>>;
  techniques: TechniqueEntry[];
  setTechniques?: Dispatch<SetStateAction<TechniqueEntry[]>>;
  categories: Record<string, IngredientCategory>;
}

/**
 * Import YAML (fusion sans suppression) et exports YAML / Markdown des trois bases
 * master de la console. Le bilan de chaque import, ou le refus d'une saisie, est
 * exposé dans `importResult` pour la popup de résultat.
 */
export function useMasterImports({ ingredientDB, setIngredientDB, utensilDB, setUtensilDB, techniques, setTechniques, categories }: MasterImportsArgs) {
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Erreurs de validation YAML : annulation totale, liste complète dans la popup.
  const reportErrors = (errors: string[]) => setImportResult({
    ok: false,
    title: "Import annulé",
    message: `${errors.length} erreur${errors.length > 1 ? "s" : ""} dans le fichier : la base n'a pas été modifiée. Corrige-le puis réimporte-le.`,
    details: errors,
  });
  const reportEmpty = (what: string) => setImportResult({ ok: false, title: "Rien à importer", message: `Aucun ${what} reconnu dans le fichier.` });
  // Bilan : seules les entrées réellement modifiées comptent, le reste est « déjà à jour ».
  const reportDone = (report: ImportReport, noun: ImportNoun) => setImportResult({
    ok: true,
    title: importHeadline(report, noun),
    message: importContext(report, noun),
    report,
  });
  const changed = (report: ImportReport) => report.created.length > 0 || report.updated.length > 0;

  const categoryOrder = sortedCategoryEntries(categories).map(([k]) => k);

  // Fusion calculée sur l'état courant (et non dans un updater de setState, que
  // React peut différer ou rejouer en mode strict) : les compteurs restent justes.
  const ingredients: BaseTransfer = {
    onExportYaml: () => downloadText("ingredients.yaml", formatIngredientsYaml(ingredientDB.map(({ _ro, ...r }) => r), { categoryOrder }), "text/yaml"),
    onExportMarkdown: () => downloadText("ingredients_cardamome.md", formatIngredientsMarkdown(ingredientDB, categoryOrder), "text/markdown"),
    onImportYaml: (text) => {
      const { items: parsed, errors } = parseIngredientsYaml(text, { validCategories: new Set(Object.keys(categories)) });
      if (errors.length) return reportErrors(errors);
      if (!parsed.length) return reportEmpty("ingrédient");
      const { next, report } = mergeImport(ingredientDB, parsed, {
        matchByName: true,
        combine: (cur, row) => ({ ...cur, ...row, id: cur.id, nutrition: row.nutrition || cur.nutrition }),
        newId: (_row, n) => "db_i" + Date.now() + "_" + n,
      });
      if (changed(report)) setIngredientDB(next);
      reportDone(report, INGREDIENT_NOUN);
    },
  };

  const utensils: BaseTransfer = {
    onExportYaml: () => downloadText("utensils.yaml", formatUtensilsYaml(utensilDB.map(({ _ro, ...r }) => r)), "text/yaml"),
    onExportMarkdown: () => downloadText("ustensiles_cardamome.md", formatUtensilsMarkdown(utensilDB), "text/markdown"),
    onImportYaml: (text) => {
      const { items: parsed, errors } = parseUtensilsYaml(text);
      if (errors.length) return reportErrors(errors);
      if (!parsed.length) return reportEmpty("ustensile");
      const { next, report } = mergeImport(utensilDB, parsed, {
        matchByName: true,
        combine: (cur, row) => ({ ...cur, ...row, id: cur.id }),
        newId: (_row, n) => "db_u" + Date.now() + "_" + n,
      });
      if (changed(report)) setUtensilDB(next);
      reportDone(report, UTENSIL_NOUN);
    },
  };

  // Glossaire : upsert par id, la ligne importée remplace l'entrée.
  const techniqueTransfer: BaseTransfer = {
    onExportYaml: () => downloadText("techniques.yaml", formatTechniquesYaml(techniques), "text/yaml"),
    onExportMarkdown: () => downloadText("techniques_cardamome.md", formatTechniquesMarkdown(techniques), "text/markdown"),
    onImportYaml: (text) => {
      const { items: parsed, errors } = parseTechniquesYaml(text);
      if (errors.length) return reportErrors(errors);
      if (!parsed.length) return reportEmpty("geste technique");
      const { next, report } = mergeImport(techniques, parsed, {
        matchByName: false,
        combine: (_cur, row) => row,
        newId: row => row.id,
      });
      if (changed(report)) setTechniques?.(next);
      reportDone(report, TECHNIQUE_NOUN);
    },
  };

  return { importResult, setImportResult, ingredients, utensils, techniques: techniqueTransfer };
}
