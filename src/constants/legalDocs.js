import { parse as parseYaml } from "yaml";
import { marked } from "marked";

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

export const LEGAL_UPDATED = "24 juillet 2026";

marked.setOptions({ gfm: true, breaks: false });

// Sépare un éventuel front-matter YAML (--- ... ---) du corps Markdown.
function splitFrontMatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  return { meta: parseYaml(m[1]) || {}, body: m[2] };
}

const modules = import.meta.glob("../content/legal/*.md", { query: "?raw", import: "default", eager: true });

export const LEGAL_DOCS = Object.entries(modules)
  .map(([path, raw]) => {
    const id = path.split("/").pop().replace(/\.md$/, "");
    const { meta, body } = splitFrontMatter(raw);
    return {
      id,
      short: meta.short || meta.title || id,
      icon: meta.icon || "fileText",
      title: meta.title || id,
      order: meta.order ?? 99,
      html: marked.parse(body.trim()),
    };
  })
  .sort((a, b) => a.order - b.order);

export const LEGAL_BY_ID = Object.fromEntries(LEGAL_DOCS.map(d => [d.id, d]));
