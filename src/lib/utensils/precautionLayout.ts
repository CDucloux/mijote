/**
 * Mise en page de la description d'une précaution d'ustensile (pur, sans I/O ni React).
 *
 * La description est éditée librement (admin) et peut contenir un petit tableau :
 *   - soit un tableau Markdown à pipes (`| Usage | Puissance |` + ligne de séparation) ;
 *   - soit une suite de lignes « label : valeur » (« Mijoter, maintenir : 1/5 à 1/3 »).
 * Rendue en texte brut, cette grille ressort en lignes peu lisibles. Ce module la
 * découpe en BLOCS ordonnés (paragraphes / tableaux) que l'UI rend proprement, sans
 * jamais réordonner ni perdre de contenu (tout ce qui n'est pas une ligne de tableau
 * reste un paragraphe, à sa place).
 *
 * @module utensils/precautionLayout
 */

/** Paragraphe de texte libre (une ou plusieurs lignes contiguës non tabulaires). */
export interface ParagraphBlock {
  kind: "paragraph";
  text: string;
}

/** Tableau : lignes de cellules, avec ou sans ligne d'en-tête. */
export interface TableBlock {
  kind: "table";
  header: string[] | null;
  rows: string[][];
}

/** Bloc de mise en page d'une description de précaution. */
export type PrecautionBlock = ParagraphBlock | TableBlock;

/** Découpe une ligne Markdown à pipes en cellules (pipes de bord optionnels). */
function pipeCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map(c => c.trim());
}

/** Vrai si la ligne est une ligne de séparation Markdown (`---`, `:--:`, espacée). */
function isSeparatorRow(line: string): boolean {
  const cells = pipeCells(line);
  return cells.length > 0 && cells.every(c => /^:?-{1,}:?$/.test(c));
}

/** Vrai si la ligne est une ligne de tableau Markdown (au moins un pipe interne). */
function isPipeRow(line: string): boolean {
  return line.includes("|");
}

/**
 * Découpe une ligne « label : valeur » en paire, ou `null` si ce n'en est pas une.
 * La valeur doit être non vide (« ... maximum : » seul, qui introduit le tableau,
 * n'est donc PAS une paire et reste un paragraphe). Gère le deux-points ASCII et
 * pleine chasse.
 */
function labelValuePair(line: string): [string, string] | null {
  const match = line.match(/^(.+?)\s*[:：]\s+(.+)$/);
  if (!match) return null;
  const label = match[1].trim();
  const value = match[2].trim();
  return label && value ? [label, value] : null;
}

/**
 * Analyse une description de précaution en blocs ordonnés (paragraphes et tableaux).
 *
 * Un tableau Markdown (lignes à pipes, éventuelle ligne de séparation) est restitué
 * avec en-tête ; une suite d'au moins deux lignes « label : valeur » devient un
 * tableau à deux colonnes sans en-tête. Tout le reste forme des paragraphes, à leur
 * place d'origine. Une description sans tableau donne un unique paragraphe.
 *
 * @param description - Le texte éditorial de la précaution (déjà rogné).
 * @returns La liste ordonnée des blocs à rendre.
 */
export function parsePrecautionDescription(description: string): PrecautionBlock[] {
  const lines = (description || "").split("\n");
  const blocks: PrecautionBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = (): void => {
    if (paragraph.length) {
      const text = paragraph.join("\n").trim();
      if (text) blocks.push({ kind: "paragraph", text });
      paragraph = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // ── Tableau Markdown à pipes ──
    if (trimmed && isPipeRow(trimmed)) {
      const pipeLines: string[] = [];
      while (i < lines.length && lines[i].trim() && isPipeRow(lines[i].trim())) {
        pipeLines.push(lines[i].trim());
        i++;
      }
      const dataLines = pipeLines.filter(l => !isSeparatorRow(l));
      if (dataLines.length) {
        flushParagraph();
        const hadSeparator = pipeLines.length > dataLines.length;
        const cells = dataLines.map(pipeCells);
        // En-tête seulement si une ligne de séparation l'a explicitement désigné.
        const header = hadSeparator ? cells[0] : null;
        const rows = hadSeparator ? cells.slice(1) : cells;
        blocks.push({ kind: "table", header, rows });
      }
      continue;
    }

    // ── Suite de lignes « label : valeur » (>= 2 d'affilée) ──
    if (trimmed && labelValuePair(trimmed)) {
      const pairs: [string, string][] = [];
      let j = i;
      while (j < lines.length) {
        const t = lines[j].trim();
        const pair = t ? labelValuePair(t) : null;
        if (!pair) break;
        pairs.push(pair);
        j++;
      }
      if (pairs.length >= 2) {
        flushParagraph();
        blocks.push({ kind: "table", header: null, rows: pairs.map(([label, value]) => [label, value]) });
        i = j;
        continue;
      }
    }

    paragraph.push(line);
    i++;
  }
  flushParagraph();
  return blocks;
}
