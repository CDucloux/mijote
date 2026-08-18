import { useId } from "react";

// ─── CROQUIS D'ÉTATS VIDES « À L'ENCRE » ──────────────────────────────────────
// Des illustrations au trait, volontairement irrégulières, pour donner aux écrans
// vides ce côté fait-main (croquis d'encre plutôt qu'icône dans une boîte). La
// signature qui les fait lire comme « dessinés par quelqu'un » : un filtre SVG de
// déformation commun (turbulence + displacement) applique la MÊME ondulation de
// pinceau à tous les tracés, d'un écran à l'autre. Le trait suit `currentColor`
// (donc le thème clair/sombre) ; un seul élément par croquis passe en accent
// terracotta, la touche chaude de Mijoté, jamais le monochrome intégral.
//
// Le trait est fait au « pinceau » : les marques principales sont des FORMES
// PLEINES effilées (épaisseur variable), pas des `stroke` uniformes, épaulées de
// lavis translucides pour le volume. Le corps du croquis (groupe `.ink-body`)
// apparaît en fondu doux, puis l'accent vient « poser » à la fin (`.ink-accent`),
// sauf la cocotte dont l'accent est la vapeur montante.

// Croquis disponibles, indexés par nom. Chacun est un fragment de tracés dans un
// viewBox 0 0 120 120 ; la déformation est ajoutée par le filtre en amont.
const ARTS = {
  // Cocotte couverte au trait de pinceau (épaisseur variable : les tracés sont des
  // FORMES PLEINES effilées, pas des `stroke` uniformes), avec lavis d'ombre et
  // d'intérieur pour le volume. Un seul accent : la vapeur, détachée au-dessus du
  // couvercle (blanc d'air), qui monte et se dissipe. « Ça mijote. »
  // Le corps apparaît en fondu (.ink-body) ; la vapeur monte ensuite.
  casserole: (
    <>
      <g className="ink-body" fill="currentColor">
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
      {/* accent unique : la vapeur, détachée du couvercle (blanc d'air) mais COURTE
          pour ne pas venir toucher le trait alentour (ex. l'anneau du loader). */}
      <path className="ink-steam" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" d="M50 39 C46 35 54 32 50 27 C47 23 52 20 49 17" />
      <path className="ink-steam2" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" d="M69 39 C73 35 65 32 69 27 C72 23 67 20 70 17" />
    </>
  ),
  // Panier de marché vide : anse en arche pleine, panse au trait épaissi, rebord en
  // lentille, lavis d'intérieur, deux fils de tressage, et un brin d'herbe (accent).
  panier: (
    <>
      <g className="ink-body" fill="currentColor">
        <path opacity="0.09" d="M31 58 C45 63 75 63 89 58 C86 71 78 85 60 85 C42 85 34 71 31 58 Z" />
        <path d="M37 56 C40 27 80 27 83 56 C79 33 41 33 37 56 Z" />
        <path fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" d="M28 57 L40 91 C52 96 68 96 80 91 L92 57" />
        <path d="M28 57 C45 63 75 63 92 57 C75 61 45 61 28 57 Z" />
        <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M48 62 L51 89" />
        <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M72 62 L69 89" />
      </g>
      <g className="ink-accent" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M78 56 C80 48 80 43 78 38" />
        <path d="M78 47 C74 45 72 46 71 48" />
        <path d="M78 50 C81 48 83 49 84 51" />
      </g>
    </>
  ),
  // Assiette dressée : rebord en anneau plein, lavis de creux, fourchette et couteau
  // de part et d'autre, un oeuf au plat dont le jaune est l'accent : « prêt à manger ».
  assiette: (
    <>
      <g className="ink-body" fill="currentColor">
        <ellipse cx="60" cy="86" rx="27" ry="3.5" opacity="0.1" />
        <path fillRule="evenodd" d="M60 52 C75 52 87 59 87 68 C87 77 75 84 60 84 C45 84 33 77 33 68 C33 59 45 52 60 52 Z M60 58 C48 58 41 63 41 68 C41 73 48 78 60 78 C72 78 79 73 79 68 C79 63 72 58 60 58 Z" />
        <ellipse cx="60" cy="68" rx="17" ry="10" opacity="0.08" />
        <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M22 63 L22 88" />
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M18 50 L19 63" />
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M22 50 L22 63" />
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M26 50 L25 63" />
        <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M98 64 L98 88" />
        <path fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" d="M98 50 C101 54 101 60 98 64" />
        <path fillOpacity="0.06" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" d="M49 67 C47 61 53 57 60 59 C67 56 74 60 72 67 C75 72 68 76 61 74 C53 76 49 72 49 67 Z" />
      </g>
      <ellipse className="ink-accent" cx="62" cy="66" rx="5.4" ry="4.7" fill="var(--accent)" />
    </>
  ),
  // Loupe : lentille en anneau plein, verre en lavis, manche en tige pleine, un reflet
  // (accent). « Rien trouvé », pour les recherches sans résultat.
  loupe: (
    <>
      <g className="ink-body" fill="currentColor">
        <circle cx="52" cy="50" r="19" opacity="0.07" />
        <path fillRule="evenodd" d="M52 26 A25 25 0 1 0 52 76 A25 25 0 1 0 52 26 Z M52 32 A19 19 0 1 1 52 70 A19 19 0 1 1 52 32 Z" />
        <path d="M67 68 L90 91 L94 87 L71 64 Z" />
      </g>
      <path className="ink-accent" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" d="M43 42 C37 47 35 55 39 63" />
    </>
  ),
  // Bocal de placard vide + un « ? » (accent) posé à côté : l'ingrédient cherché
  // n'est pas au catalogue. Pour les recherches d'ingrédient sans résultat (stock).
  bocal: (
    <>
      <g className="ink-body" fill="currentColor">
        <path opacity="0.08" d="M42 45 L42 86 C42 90 45 92 49 92 L67 92 C71 92 74 90 74 86 L74 45 Z" />
        <path d="M45 32 C45 30 46 29 48 29 L68 29 C70 29 71 30 71 32 L71 39 C71 41 70 42 68 42 L48 42 C46 42 45 41 45 39 Z" />
        <path fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" d="M43 42 C43 49 40 51 40 59 L40 87 C40 92 44 95 49 95 L67 95 C72 95 76 92 76 87 L76 59 C76 51 73 49 73 42" />
      </g>
      <g className="ink-accent" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M83 45 C82 38 96 37 95 46 C94 50 89 50 89 55" />
        <path d="M89 60 L89 61" />
      </g>
    </>
  ),
  // Petite liste toute cochée (coches en accent) : « rien à racheter », tout est
  // là. Pour l'état vide « bientôt vide » du stock quand rien n'est à racheter.
  liste: (
    <>
      <g className="ink-body" fill="currentColor">
        <path opacity="0.07" d="M34 30 L86 30 L86 96 L34 96 Z" />
        <path fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" d="M34 32 C34 30 35 29 37 29 L83 29 C85 29 86 30 86 32 L86 92 C86 94 85 95 83 95 L37 95 C35 95 34 94 34 92 Z" />
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M55 46 L79 46" />
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M55 62 L79 62" />
        <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M55 78 L79 78" />
      </g>
      <g className="ink-accent" fill="none" stroke="var(--accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 46 L44 50 L50 41" />
        <path d="M40 62 L44 66 L50 57" />
        <path d="M40 78 L44 82 L50 73" />
      </g>
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
          <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g className="ink-art" filter={`url(#${fid})`}>{art}</g>
    </svg>
  );
}
