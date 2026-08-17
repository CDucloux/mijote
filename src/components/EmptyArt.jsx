import { useId } from "react";

// ─── CROQUIS D'ÉTATS VIDES « À L'ENCRE » ──────────────────────────────────────
// Des illustrations au trait, volontairement irrégulières, pour donner aux écrans
// vides ce côté fait-main (croquis d'encre plutôt qu'icône dans une boîte). La
// signature qui les fait lire comme « dessinés par quelqu'un » : un filtre SVG de
// déformation commun (turbulence + displacement) applique la MÊME ondulation de
// pinceau à tous les tracés, d'un écran à l'autre. Le trait suit `currentColor`
// (donc le thème clair/sombre) ; un seul élément par croquis passe en accent
// terracotta, la touche chaude de Mijoté, jamais le monochrome intégral.

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2.3, strokeLinecap: "round", strokeLinejoin: "round" };

// Croquis disponibles, indexés par nom. Chacun est un fragment de tracés dans un
// viewBox 0 0 120 120 ; la déformation est ajoutée par le filtre en amont.
const ARTS = {
  // Cocotte ouverte et vide + deux volutes de vapeur (une chaude) : « à remplir ».
  casserole: (
    <>
      <path {...STROKE} d="M32 60 C31 74 35 87 41 92 C53 98 71 98 83 92 C89 87 92 74 91 60" />
      <path {...STROKE} d="M32 60 C42 66 82 66 91 60" />
      <path {...STROKE} d="M32 60 C42 54 82 54 91 60" />
      <path {...STROKE} d="M32 66 C24 63 20 68 22 73 C23 76 27 77 31 75" />
      <path {...STROKE} d="M91 66 C99 63 103 68 101 73 C100 76 96 77 92 75" />
      <path {...STROKE} d="M54 52 C50 45 57 41 53 33 C50 27 56 23 53 17" />
      <path {...STROKE} stroke="var(--accent)" d="M70 52 C66 46 73 42 69 34 C66 29 72 25 69 19" />
    </>
  ),
  // Panier de marché vide, tressage suggéré, un brin d'herbe posé sur le bord (accent).
  panier: (
    <>
      <path {...STROKE} d="M37 58 C40 27 80 27 83 58" />
      <path {...STROKE} d="M28 58 L40 92 C52 97 68 97 80 92 L92 58" />
      <path {...STROKE} d="M28 58 C45 64 75 64 92 58" />
      <path {...STROKE} d="M28 58 C45 53 75 53 92 58" />
      <path {...STROKE} d="M47 61 L50 90" />
      <path {...STROKE} d="M60 62 L60 93" />
      <path {...STROKE} d="M73 61 L70 90" />
      <path {...STROKE} stroke="var(--accent)" d="M77 57 C79 51 79 47 77 43" />
      <path {...STROKE} stroke="var(--accent)" d="M77 49 C74 47 72 48 71 50" />
      <path {...STROKE} stroke="var(--accent)" d="M77 52 C80 50 82 51 83 53" />
    </>
  ),
  // Assiette dressée, fourchette et couteau, un filet de vapeur (accent) : « prêt à cuisiner ».
  assiette: (
    <>
      <ellipse {...STROKE} cx="60" cy="66" rx="27" ry="18" />
      <ellipse {...STROKE} cx="60" cy="66" rx="17" ry="11" />
      <path {...STROKE} d="M31 46 C30 62 31 80 33 90" />
      <path {...STROKE} d="M27 44 L28 55" />
      <path {...STROKE} d="M31 44 L31 55" />
      <path {...STROKE} d="M35 44 L34 55" />
      <path {...STROKE} d="M89 44 C90 62 89 80 87 90" />
      <path {...STROKE} d="M89 44 C93 48 93 54 89 58" />
      <path {...STROKE} stroke="var(--accent)" d="M60 50 C56 43 63 39 59 32" />
    </>
  ),
};

/**
 * Illustration d'état vide au trait, avec le rendu « encre » commun.
 *
 * @param name Croquis à afficher (`casserole`, `panier`, `assiette`).
 * @param size Côté du carré de rendu en pixels (viewBox interne fixe).
 * @param style Styles complémentaires posés sur le `<svg>` (ex. marge basse).
 */
export function EmptyArt({ name, size = 128, style }) {
  // `useId` par instance : chaque croquis a SON filtre, pas de collision d'id
  // même quand plusieurs états vides coexistent. Les deux-points sont retirés
  // car `url(#…)` les tolère mal.
  const fid = "ink" + useId().replace(/:/g, "");
  const art = ARTS[name] || ARTS.casserole;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden="true"
      style={{ color: "var(--text2)", flexShrink: 0, ...style }}>
      <defs>
        <filter id={fid} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.017" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${fid})`}>{art}</g>
    </svg>
  );
}
