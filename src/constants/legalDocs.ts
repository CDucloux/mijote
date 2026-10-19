import { marked } from "marked";
import { readingMinutes } from "../lib/format.js";
import { parseFrontMatter, metaString, metaNumber } from "@/lib/data/frontMatter.js";

// ─── DOCUMENTS LÉGAUX ─────────────────────────────────────────────────────────
// Les documents vivent en Markdown dans src/content/legal/*.md (un fichier par
// document), avec un front-matter YAML pour les métadonnées. On les charge à la
// compilation via import.meta.glob, on sépare le front-matter du corps, et on
// pré-rend le Markdown en HTML (contenu de confiance, écrit par nous).
//
// ⚠️ INFOS À COMPLÉTER avant prod : voir les [entre crochets] dans les .md
//    (identité de l'éditeur, contact, directeur de publication…). Premier jet à
//    FAIRE RELIRE. Le slug du document = le nom de fichier (ex. privacy.md →
//    /legal/privacy).

export const LEGAL_UPDATED = "12 octobre 2026";

marked.setOptions({ gfm: true, breaks: false });

// Repère les mentions encore à renseigner (« [... à compléter ...] ») pour qu'elles
// sautent aux yeux au rendu. Les liens Markdown `[texte](url)` sont épargnés.
function markPlaceholders(body: string): string {
  return body.replace(/\*{0,2}\[([^\]]*à (?:compléter|confirmer)[^\]]*)\]\*{0,2}(?!\()/g, '<mark class="legal-todo">$1</mark>');
}

// Recopie l'intitulé de colonne sur chaque cellule (`data-label`) : sur mobile, les
// tableaux s'empilent en fiches et chaque valeur y garde son intitulé (cf. CSS).
function labelTableCells(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (table) => {
    const heads = [...table.matchAll(/<th(?:\s[^>]*)?>([\s\S]*?)<\/th>/g)].map(m => m[1].replace(/<[^>]+>/g, "").trim().replace(/"/g, "&quot;"));
    return table.replace(/<tr>([\s\S]*?)<\/tr>/g, (row) => {
      let i = 0;
      return row.replace(/<td([^>]*)>/g, (_, attrs) => `<td${attrs} data-label="${heads[i++] ?? ""}">`);
    });
  });
}

/** Un document légal, pré-rendu en HTML. */
export interface LegalDoc {
  id: string;
  short: string;
  lead: string;
  minutes: number;
  icon: string;
  title: string;
  order: number;
  html: string;
}

const modules = import.meta.glob<string>("../content/legal/*.md", { query: "?raw", import: "default", eager: true });

export const LEGAL_DOCS: LegalDoc[] = Object.entries(modules)
  .map(([path, raw]) => {
    const id = (path.split("/").pop() ?? "").replace(/\.md$/, "");
    const { meta, body } = parseFrontMatter(raw);
    return {
      id,
      short: metaString(meta, "short") || metaString(meta, "title") || id,
      lead: metaString(meta, "lead") || "",
      minutes: readingMinutes(body),
      icon: metaString(meta, "icon") || "fileText",
      title: metaString(meta, "title") || id,
      order: metaNumber(meta, "order") ?? 99,
      html: labelTableCells(marked.parse(markPlaceholders(body.trim()), { async: false })),
    };
  })
  .sort((a, b) => a.order - b.order);

export const LEGAL_BY_ID: Record<string, LegalDoc | undefined> = Object.fromEntries(LEGAL_DOCS.map(d => [d.id, d]));
