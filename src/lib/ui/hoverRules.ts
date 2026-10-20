/**
 * Garde-fou du système de survol (cf. `src/styles/interactions.css`).
 *
 * Logique pure : analyse le texte d'une feuille CSS et signale les règles `:hover`
 * qui sortent du contrat. Un test l'exécute sur toutes les feuilles de l'app pour
 * qu'un survol collé au tactile, une couleur en dur ou un `!important` ne revienne
 * pas en douce.
 *
 * @module ui/hoverRules
 */

/** Seule garde admise autour d'un survol : pointeur fin capable de survoler. */
export const HOVER_GUARD = "@media (hover: hover) and (pointer: fine)";

/** Règle CSS à plat : sélecteur, déclarations, ligne (1-based) et at-rules englobantes. */
export interface CssRule {
  selector: string;
  body: string;
  line: number;
  atRules: string[];
}

/** Nature d'un écart au contrat de survol. */
export type HoverViolationKind = "unguarded" | "important" | "hardcoded-color";

/** Écart détecté sur une règle `:hover`. */
export interface HoverViolation {
  kind: HoverViolationKind;
  selector: string;
  line: number;
  /** Extrait fautif (couleur en dur) quand il y en a un. */
  detail?: string;
}

const normalize = (s: string): string => s.replace(/\s+/g, " ").replace(/\s*:\s*/g, ": ").trim();

/**
 * Découpe une feuille CSS en règles à plat. Les commentaires sont neutralisés en
 * conservant leurs retours à la ligne, pour que les numéros de ligne restent justes.
 * Gère l'imbrication native (`&::before` après des déclarations). Ne vise pas la
 * conformité CSS complète : chaînes contenant `{`, `}` ou `;` ne sont pas gérées
 * (absentes des feuilles de l'app).
 *
 * @param css - Contenu de la feuille.
 * @returns Les règles de style, at-rules de bloc exclues (mais mémorisées en contexte).
 */
export function parseCssRules(css: string): CssRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  const rules: CssRule[] = [];
  const stack: { prelude: string; isAt: boolean }[] = [];
  let start = 0;
  let line = 1;
  let preludeLine = 1;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\n") line++;
    else if (ch === "{") {
      const raw = src.slice(start, i);
      const prelude = raw.trim();
      const isAt = prelude.startsWith("@");
      const leading = raw.length - raw.trimStart().length;
      preludeLine = line - (raw.slice(leading).match(/\n/g)?.length ?? 0);
      stack.push({ prelude, isAt });
      if (!isAt) {
        const end = src.indexOf("}", i);
        rules.push({
          selector: prelude.replace(/\s+/g, " "),
          body: src.slice(i + 1, end === -1 ? src.length : end).trim(),
          line: preludeLine,
          atRules: stack.filter((s) => s.isAt).map((s) => normalize(s.prelude)),
        });
      }
      start = i + 1;
    } else if (ch === "}") {
      stack.pop();
      start = i + 1;
    } else if (ch === ";") {
      start = i + 1;
    }
  }
  return rules;
}

/**
 * Membres d'une liste de sélecteurs, `:where(…)`/`:is(…)` englobant déplié : sert à
 * vérifier que les listes d'intentions du registre restent cohérentes entre elles.
 * Les virgules imbriquées (`:not(.a, .b)`) ne coupent pas.
 *
 * @param selector - Sélecteur de règle (une liste, éventuellement enveloppée).
 * @returns Les membres, espaces normalisés, dans l'ordre.
 */
export function selectorMembers(selector: string): string[] {
  const trimmed = selector.trim();
  const wrapped = /^:(where|is)\((.*)\)$/s.exec(trimmed);
  const list = wrapped && balanced(wrapped[2]) ? wrapped[2] : trimmed;
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) { out.push(list.slice(start, i)); start = i + 1; }
  }
  out.push(list.slice(start));
  return out.map((m) => m.replace(/\s+/g, " ").trim()).filter(Boolean);
}

const balanced = (s: string): boolean => {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) return false;
  }
  return depth === 0;
};

const isGray = (r: string, g: string, b: string): boolean => r === g && g === b && (r === "0" || r === "255");
const HEX_NEUTRALS = new Set(["#fff", "#ffffff", "#000", "#000000"]);

/**
 * Couleurs littérales hors tokens dans un bloc de déclarations. Le noir et le blanc
 * purs restent admis (ombres, voiles sur photo) ; toute autre teinte doit passer par
 * un token (`var(--…)`, `rgba(var(--…-rgb), a)`).
 *
 * @param body - Déclarations d'une règle.
 * @returns Les littéraux fautifs, dans l'ordre d'apparition.
 */
export function hardcodedColors(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)[^)]*\)/g)) {
    if (!isGray(m[1], m[2], m[3])) out.push(m[0]);
  }
  for (const m of body.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    if (!HEX_NEUTRALS.has(m[0].toLowerCase())) out.push(m[0]);
  }
  return out;
}

/**
 * Contrôle les règles `:hover` d'une feuille : garde pointeur fin obligatoire, pas de
 * `!important` (le système de voile n'en a pas besoin), pas de couleur en dur.
 *
 * @param css - Contenu de la feuille.
 * @returns Les écarts, dans l'ordre du fichier (vide si la feuille est conforme).
 */
export function auditHoverRules(css: string): HoverViolation[] {
  const out: HoverViolation[] = [];
  for (const rule of parseCssRules(css)) {
    if (!rule.selector.includes(":hover")) continue;
    const { selector, line } = rule;
    if (!rule.atRules.includes(normalize(HOVER_GUARD))) out.push({ kind: "unguarded", selector, line });
    if (rule.body.includes("!important")) out.push({ kind: "important", selector, line });
    for (const detail of hardcodedColors(rule.body)) out.push({ kind: "hardcoded-color", selector, line, detail });
  }
  return out;
}
