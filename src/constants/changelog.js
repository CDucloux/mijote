// ─── CHANGELOG ────────────────────────────────────────────────────────────────
// Source unique de vérité : CHANGELOG.md (racine du dépôt). Ce module le parse
// au build (import `?raw`) pour alimenter l'UI – plus aucun changelog dupliqué
// à maintenir en parallèle. Format attendu par entrée :
//
//   ## v1.2.3 – Libellé
//   - item
//   - item
//
import raw from "../../CHANGELOG.md?raw";

const HEADER = /^##\s+v([\d.]+)\s*[—––-]?\s*(.*)$/;
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
    if (bullet && current) current.items.push(bullet[1].trim());
  }
  // L'entrée en tête (la plus récente) est mise en avant ; `highlights` reprend
  // ses deux premières lignes pour le bandeau d'annonce de nouveautés.
  // `codename` = nom de code de la version, soit la partie du libellé avant un
  // « · » (convention « Safran · Industrialisation »), sinon aucun.
  return entries.map((entry, i) => ({
    ...entry,
    accent: i === 0,
    highlights: entry.items.slice(0, 2),
    codename: entry.label.includes("·") ? entry.label.split("·")[0].trim() : null,
  }));
}

export const CHANGELOG = parseChangelog(raw);

// Nom de code associé à une version (pour le badge de l'app). Retombe sur la
// version la plus récente si la version exacte n'est pas trouvée.
export function codenameFor(version) {
  const entry = CHANGELOG.find(e => e.version === version) || CHANGELOG[0];
  return entry?.codename || null;
}
