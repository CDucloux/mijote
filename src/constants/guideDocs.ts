import { marked } from "marked";
import { parseFrontMatter, metaString, metaNumber } from "@/lib/data/frontMatter.js";

// ─── GUIDE D'UTILISATION ────────────────────────────────────────────────────────
// Le guide « comment qu'on fait » de Cardamome. Chaque thème vit en Markdown dans
// src/content/guide/*.md (un fichier par thème), avec un front-matter YAML pour les
// métadonnées (titre, résumé, icône, ordre). On les charge à la compilation via
// import.meta.glob, on sépare le front-matter du corps, et on pré-rend le Markdown
// en HTML (contenu de confiance, écrit par nous). Même patron que legalDocs.js.
// Le slug du thème = le nom de fichier (ex. demarrer.md → /guide/demarrer).

marked.setOptions({ gfm: true, breaks: false });

/** Un thème du guide, pré-rendu en HTML. */
export interface GuideDoc {
  id: string;
  short: string;
  icon: string;
  title: string;
  color: string;
  lead: string;
  order: number;
  html: string;
}

const modules = import.meta.glob<string>("../content/guide/*.md", { query: "?raw", import: "default", eager: true });

export const GUIDE_DOCS: GuideDoc[] = Object.entries(modules)
  .map(([path, raw]) => {
    const id = (path.split("/").pop() ?? "").replace(/\.md$/, "");
    const { meta, body } = parseFrontMatter(raw);
    return {
      id,
      short: metaString(meta, "short") || metaString(meta, "title") || id,
      icon: metaString(meta, "icon") || "bulb",
      title: metaString(meta, "title") || id,
      // Couleur d'accent du thème (front-matter), reprise sur la carte d'index,
      // le hero et les repères de la prose. Défaut : l'accent global de l'app.
      color: metaString(meta, "color") || "var(--accent)",
      lead: metaString(meta, "lead") || metaString(meta, "short") || "",
      order: metaNumber(meta, "order") ?? 99,
      // Sans extension asynchrone, `marked.parse` est synchrone (son type couvre les deux cas).
      html: marked.parse(body.trim(), { async: false }),
    };
  })
  .sort((a, b) => a.order - b.order);

export const GUIDE_BY_ID: Record<string, GuideDoc | undefined> = Object.fromEntries(GUIDE_DOCS.map(d => [d.id, d]));
