// Genere les icones de lanceur Android « legacy » (API 24-25) a partir du logo
// Cardamome. Les appareils API 26+ utilisent l'icone adaptative vectorielle
// (mipmap-anydpi-v26 + drawable-v24/ic_launcher_foreground.xml, edites a la main) ;
// ce script ne couvre que le repli raster carre / rond des anciennes versions.
//
// Usage : node scripts/gen-android-icons.mjs
// Regenerer apres toute evolution du logo (garder la coherence avec favicon.svg).

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RES = join(ROOT, "android/app/src/main/res");
const GREEN = "#6E9A3F";

// Gousse de cardamome (coords 0..100, reprise de public/favicon.svg), nervures
// dans le vert du fond pour l'effet « creux ». `shape` porte le fond (rect arrondi
// ou cercle) rendu avant le pod.
const pod = () => `
  <g transform="rotate(45 50 50)">
    <path d="M50 15 C68 30 74 48 67 63 C62.5 74 55.5 80 50 85 C44.5 80 37.5 74 33 63 C26 48 32 30 50 15 Z" fill="#ffffff"/>
    <g fill="none" stroke="${GREEN}" stroke-linecap="round">
      <path d="M50 24 C50 40 50 62 50 77" stroke-width="3.4"/>
      <path d="M42 30 C39.5 45 41 60 47 74" stroke-width="3"/>
      <path d="M58 30 C60.5 45 59 60 53 74" stroke-width="3"/>
    </g>
  </g>`;

const icon = (shape) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${shape}${pod()}</svg>`;

const SQUARE = icon(`<rect width="100" height="100" rx="24" fill="${GREEN}"/>`);
const ROUND = icon(`<circle cx="50" cy="50" r="50" fill="${GREEN}"/>`);

// Densites Android -> taille du lanceur en px.
const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };

async function render(svg, size, out) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(out, png);
}

for (const [density, size] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${density}`);
  await mkdir(dir, { recursive: true });
  await render(SQUARE, size, join(dir, "ic_launcher.png"));
  await render(ROUND, size, join(dir, "ic_launcher_round.png"));
  console.log(`mipmap-${density}: ic_launcher(.png|_round.png) @ ${size}px`);
}
