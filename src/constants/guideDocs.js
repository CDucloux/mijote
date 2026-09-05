import { parse as parseYaml } from "yaml";
import { marked } from "marked";

// ─── GUIDE D'UTILISATION ────────────────────────────────────────────────────────
// Le guide « comment qu'on fait » de Cardamome. Chaque thème vit en Markdown dans
// src/content/guide/*.md (un fichier par thème), avec un front-matter YAML pour les
// métadonnées (titre, résumé, icône, ordre). On les charge à la compilation via
// import.meta.glob, on sépare le front-matter du corps, et on pré-rend le Markdown
// en HTML (contenu de confiance, écrit par nous). Même patron que legalDocs.js.
// Le slug du thème = le nom de fichier (ex. demarrer.md → /guide/demarrer).

marked.setOptions({ gfm: true, breaks: false });

// Sépare un éventuel front-matter YAML (--- ... ---) du corps Markdown.
function splitFrontMatter(raw) {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  return { meta: parseYaml(m[1]) || {}, body: m[2] };
}

const modules = import.meta.glob("../content/guide/*.md", { query: "?raw", import: "default", eager: true });

export const GUIDE_DOCS = Object.entries(modules)
  .map(([path, raw]) => {
    const id = path.split("/").pop().replace(/\.md$/, "");
    const { meta, body } = splitFrontMatter(raw);
    return {
      id,
      short: meta.short || meta.title || id,
      icon: meta.icon || "bulb",
      title: meta.title || id,
      // Couleur d'accent du thème (front-matter), reprise sur la carte d'index,
      // le hero et les repères de la prose. Défaut : l'accent global de l'app.
      color: meta.color || "var(--accent)",
      lead: meta.lead || meta.short || "",
      order: meta.order ?? 99,
      html: marked.parse(body.trim()),
    };
  })
  .sort((a, b) => a.order - b.order);

export const GUIDE_BY_ID = Object.fromEntries(GUIDE_DOCS.map(d => [d.id, d]));
