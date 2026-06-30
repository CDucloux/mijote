// ─── GLOSSAIRE EN CONTEXTE – repérage des techniques dans un texte (pur) ──────
// Repère les gestes culinaires (suer, déglacer, monter au beurre…) dans le texte
// d'une étape, pour les surligner et afficher leur définition au survol/tap.
// Logique pure, sans React : le composant fournit le texte et le glossaire.

import { normalizeName } from "./nameMatcher.js";

// Index de recherche : map « phrase normalisée » → technique, + longueur max en mots.
// Les formes reconnues = le nom + les `aliases` (déjà des formes du verbe).
export function buildTechniqueIndex(techniques) {
  const phrases = new Map();
  let maxWords = 1;
  for (const t of techniques || []) {
    if (!t?.id) continue;
    for (const form of [t.name, ...(Array.isArray(t.aliases) ? t.aliases : [])]) {
      const norm = normalizeName(form);
      if (!norm) continue;
      if (!phrases.has(norm)) phrases.set(norm, t);
      maxWords = Math.max(maxWords, norm.split(" ").length);
    }
  }
  return { phrases, maxWords };
}

// Tokens « mots » (lettres accentuées + chiffres) avec leurs offsets dans le texte.
function tokenize(text) {
  const tokens = [];
  const re = /[A-Za-zÀ-ÿ0-9]+/g;
  let m;
  while ((m = re.exec(text))) {
    tokens.push({ norm: normalizeName(m[0]), start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

// Découpe `text` en segments { text, tech } : `tech` non nul = portion à surligner.
// Le texte original (casse, ponctuation, espaces) est intégralement préservé :
// concaténer les `text` redonne l'entrée. Correspondance gloutonne (phrase la plus
// longue d'abord), insensible à la casse et aux accents.
export function annotateText(text, index) {
  if (!text) return [{ text: "", tech: null }];
  if (!index || !index.phrases || index.phrases.size === 0) return [{ text, tech: null }];

  const tokens = tokenize(text);
  const segments = [];
  let cursor = 0; // dernière position émise
  let i = 0;
  while (i < tokens.length) {
    let tech = null, len = 0;
    const maxL = Math.min(index.maxWords, tokens.length - i);
    for (let L = maxL; L >= 1; L--) {
      const phrase = tokens.slice(i, i + L).map(t => t.norm).filter(Boolean).join(" ");
      const hit = phrase && index.phrases.get(phrase);
      if (hit) { tech = hit; len = L; break; }
    }
    if (tech) {
      const startTok = tokens[i], endTok = tokens[i + len - 1];
      if (startTok.start > cursor) segments.push({ text: text.slice(cursor, startTok.start), tech: null });
      segments.push({ text: text.slice(startTok.start, endTok.end), tech });
      cursor = endTok.end;
      i += len;
    } else {
      i += 1;
    }
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), tech: null });
  return segments;
}

// Y a-t-il au moins une technique repérée dans le texte ? (pour décider d'un indice)
export function hasTechnique(text, index) {
  return annotateText(text, index).some(s => s.tech);
}
