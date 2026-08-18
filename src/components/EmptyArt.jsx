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
  // Cocotte couverte au trait de pinceau (épaisseur variable : les tracés sont des
  // FORMES PLEINES effilées, pas des `stroke` uniformes), avec lavis d'ombre et
  // d'intérieur pour le volume. Un seul accent : la vapeur, détachée au-dessus du
  // couvercle (blanc d'air), qui monte et se dissipe. « Ça mijote. »
  // Le corps est révélé par un balayage bas->haut (.ink-wipe-up) car les
  // remplissages ne se dessinent pas au dashoffset ; la vapeur monte ensuite.
  casserole: (
    <>
      <g className="ink-wipe-up" fill="currentColor">
        {/* lavis : ombre portée + intérieur (volume, direction de lumière) */}
        <ellipse cx="60" cy="98" rx="23" ry="3.4" opacity="0.1" />
        <path opacity="0.12" d="M36 58 C46 62 74 62 84 58 C82 65 38 65 36 58 Z" />
        {/* panse : paroi effilée, fine au bord, épaisse en bas, un peu inégale */}
        <path d="M33 58 C32 78 42 94 60 93 C79 94 88 77 87 58 C85 76 76 89 60 88 C45 88 35 76 33 58 Z" />
        {/* rebord : lentille effilée, légèrement asymétrique */}
        <path d="M33 58 C44 65 74 64 87 58 C75 62 45 62 33 58 Z" />
        {/* couvercle : dôme effilé, penché (sommet décentré) */}
        <path d="M35 57 C38 45 78 45 86 56 C80 50 40 50 35 57 Z" />
        {/* bouton */}
        <path d="M55 46 C56 41 65 41 66 46 C64 44 57 44 55 46 Z" />
        {/* anses : petites oreilles effilées, volontairement inégales */}
        <path d="M35 65 C25 62 21 69 25 75 C26 71 31 70 35 70 Z" />
        <path d="M85 66 C95 64 100 70 96 76 C95 72 90 71 85 71 Z" />
      </g>
      {/* accent unique : la vapeur, détachée du couvercle, montante */}
      <path className="ink-steam" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" d="M50 34 C45 28 55 24 50 17 C45 11 54 7 49 2" />
      <path className="ink-steam2" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" d="M69 35 C74 29 64 25 69 18 C74 12 65 8 70 3" />
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
  // Loupe avec un reflet (accent) : « rien trouvé », pour les recherches sans résultat.
  loupe: (
    <>
      <ellipse {...STROKE} cx="53" cy="52" rx="24" ry="24" />
      <path {...STROKE} d="M70 69 C78 77 83 82 90 90" />
      <path {...STROKE} d="M67 72 C73 78 78 82 85 88" />
      <path {...STROKE} stroke="var(--accent)" d="M44 42 C38 47 36 55 40 63" />
    </>
  ),
  // Bocal de placard vide + un « ? » (accent) posé à côté : l'ingrédient cherché
  // n'est pas au catalogue. Pour les recherches d'ingrédient sans résultat (stock).
  bocal: (
    <>
      <path {...STROKE} d="M46 33 C46 30 72 30 72 33 L72 40 C72 43 46 43 46 40 Z" />
      <path {...STROKE} d="M48 40 C48 47 42 48 42 56 L42 86 C42 92 47 96 53 96 L65 96 C71 96 76 92 76 86 L76 56 C76 48 70 47 70 40" />
      <path {...STROKE} d="M47 67 C47 65 71 65 71 67 L71 80 C71 82 47 82 47 80 Z" />
      <path {...STROKE} stroke="var(--accent)" d="M82 44 C81 37 95 36 94 45 C93 49 88 49 88 54" />
      <path {...STROKE} stroke="var(--accent)" d="M88 59 L88 60" />
    </>
  ),
  // Petite liste toute cochée (coches en accent) : « rien à racheter », tout est
  // là. Pour l'état vide « bientôt vide » du stock quand rien n'est à racheter.
  liste: (
    <>
      <path {...STROKE} d="M32 31 C32 28.5 34 27 36.5 27 L83.5 27 C86 27 88 28.5 88 31 L88 93 C88 95.5 86 97 83.5 97 L36.5 97 C34 97 32 95.5 32 93 Z" />
      <path {...STROKE} d="M55 45 L80 45" />
      <path {...STROKE} d="M55 62 L80 62" />
      <path {...STROKE} d="M55 79 L80 79" />
      <path {...STROKE} stroke="var(--accent)" d="M40 45 L43 48 L48.5 40" />
      <path {...STROKE} stroke="var(--accent)" d="M40 62 L43 65 L48.5 57" />
      <path {...STROKE} stroke="var(--accent)" d="M40 79 L43 82 L48.5 74" />
    </>
  ),
};

/**
 * Illustration d'état vide au trait, avec le rendu « encre » commun.
 *
 * @param name Croquis à afficher (`casserole`, `panier`, `assiette`, `loupe`, `bocal`, `liste`).
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
      <g className="ink-art" filter={`url(#${fid})`}>{art}</g>
    </svg>
  );
}
