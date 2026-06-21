// ─── CHANGELOG ────────────────────────────────────────────────────────────────
// Source unique de vérité : CHANGELOG.md (racine du dépôt). Ce module le parse
// au build (import `?raw`) pour alimenter l'UI — plus aucun changelog dupliqué
// à maintenir en parallèle. Format attendu par entrée :
//
//   ## v1.2.3 — Libellé
//   - item
//   - item
//
import raw from "../../CHANGELOG.md?raw";

const HEADER = /^##\s+v([\d.]+)\s*[—–-]?\s*(.*)$/;
const BULLET = /^[-*]\s+(.+)$/;

function parseChangelog(md) {
  const entries = [];
  let current = null;
  for (const line of md.split(/\r?\n/)) {
    const header = line.match(HEADER);
    if (header) {
      current = { version: header[1], label: header[2].trim(), items: [] };
      entries.push(current);
      continue;
    }
    const bullet = line.match(BULLET);
    if (bullet && current) current.items.push(bullet[1].replace(/`/g, "").trim());
  }
  // L'entrée en tête (la plus récente) est mise en avant ; `highlights` reprend
  // ses deux premières lignes pour le bandeau d'annonce de nouveautés.
  return entries.map((entry, i) => ({
    ...entry,
    accent: i === 0,
    highlights: entry.items.slice(0, 2),
  }));
}

export const CHANGELOG = parseChangelog(raw);
