import { useId } from "react";
import "../../styles/landing-fridge.css";

/** Ombre de contact sous un aliment : il repose sur la clayette au lieu de flotter. */
function Contact({ cx, y, rx }) {
  return <ellipse cx={cx} cy={y + 0.6} rx={rx} ry={1.8} className="lpfr-contact" />;
}

// Porte entrouverte d'environ 90° vers le spectateur, charnière sur le montant
// droit : vue presque de profil, étroite, son bord libre est PLUS PROCHE donc plus
// haut que la charnière. Toute ligne horizontale de la porte fuit vers la hauteur
// d'œil de la cavité (EYE_Y) : au-dessus de l'œil elle monte vers le bord libre,
// en dessous elle descend. t = 0 (charnière) → 1 (bord libre).
const EYE_Y = 210;
const HINGE_X = 194;
const DOOR_W = 70;
const SPREAD = 0.06;

/** Projette un point de la porte (position `t` sur sa largeur, hauteur `y` côté
 *  charnière) dans le repère du dessin. */
function doorPt(t, y) {
  return [HINGE_X + DOOR_W * t, EYE_Y + (y - EYE_Y) * (1 + SPREAD * t)];
}
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

/** Bac de contre-porte : façade en trapèze fuyant, et ses produits posés au fond,
 *  chacun à sa position `t` et à l'échelle de sa profondeur. Chaque produit est
 *  dessiné en repère local, centré, base en y = 0. */
function DoorBin({ y, items }) {
  return (
    <g>
      {items.map(({ t, node }, i) => {
        const [x, base] = doorPt(t, y + 9);
        return <g key={i} transform={`translate(${x.toFixed(1)} ${base.toFixed(1)}) scale(${(1 + SPREAD * t).toFixed(3)})`}>{node}</g>;
      })}
      <polygon points={pts([doorPt(0.07, y), doorPt(0.93, y), doorPt(0.93, y + 15), doorPt(0.07, y + 15)])} className="lpfr-bin" />
      <polyline points={pts([doorPt(0.07, y), doorPt(0.93, y)])} className="lpfr-binlip" />
    </g>
  );
}

/** Clayette en verre vue de face : fine plaque en trapèze (profondeur), chant
 *  avant opaque et liseré de lumière. `y` = chant avant. */
function Shelf({ y }) {
  return (
    <g>
      <polygon points={`18,${y} 182,${y} 170,${y - 10} 30,${y - 10}`} className="lpfr-glass" />
      <rect x="18" y={y} width="164" height="3.5" className="lpfr-edge" />
      <rect x="18" y={y} width="164" height="1" className="lpfr-sheen" />
    </g>
  );
}

/**
 * Scène du hero : un frigo ouvert, bien garni, mais sans rien d'évident à
 * cuisiner. C'est le PROBLÈME que l'app résout, pas l'app. Illustration SVG
 * inline (aucun asset) : la carrosserie et l'intérieur suivent les tokens du
 * thème, les aliments gardent leurs vraies couleurs. Le « ? » est tracé à la
 * main (dessin du trait au chargement), sans halo.
 */
export function FridgeScene() {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const light = `lpfr-light-${uid}`;
  const tomato = `lpfr-tomato-${uid}`;
  const carrot = `lpfr-carrot-${uid}`;
  return (
    <div className="lp-fridge" aria-hidden="true">
      <svg className="lp-fridge__svg" viewBox="0 -10 276 446" role="presentation">
        <defs>
          <linearGradient id={light} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff8e6" stopOpacity="0.5" />
            <stop offset="1" stopColor="#fff8e6" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={tomato} cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" stopColor="#e2704f" />
            <stop offset="1" stopColor="#a5361e" />
          </radialGradient>
          <linearGradient id={carrot} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0954a" />
            <stop offset="1" stopColor="#c8621d" />
          </linearGradient>
        </defs>

        {/* Ombre au sol, pieds, carrosserie */}
        <ellipse cx="138" cy="428" rx="132" ry="3.6" className="lpfr-floor" />
        <rect x="24" y="410" width="16" height="7" rx="2" className="lpfr-foot" />
        <rect x="160" y="410" width="16" height="7" rx="2" className="lpfr-foot" />
        <rect x="6" y="6" width="188" height="408" rx="20" className="lpfr-shell" />

        {/* Cavité : fond, parois en perspective, plafonnier et sa lumière */}
        <rect x="18" y="20" width="164" height="380" rx="10" className="lpfr-cavity" />
        <rect x="30" y="32" width="140" height="356" className="lpfr-back" />
        <polygon points="18,20 30,32 30,388 18,400" className="lpfr-wall" />
        <polygon points="182,20 170,32 170,388 182,400" className="lpfr-wall" />
        <polygon points="18,20 182,20 170,32 30,32" className="lpfr-ceil" />
        <polygon points="84,37 116,37 170,150 30,150" fill={`url(#${light})`} />
        <rect x="84" y="33" width="32" height="4" rx="2" className="lpfr-lamp" />

        {/* Clayette haute : brique de lait, yaourts, confiture, huile d'olive */}
        <Shelf y={130} />
        <g>
          <Contact cx={49} y={126} rx={14} />
          <rect x="36" y="76" width="26" height="50" rx="1.5" fill="#ece6d6" />
          <rect x="55" y="76" width="7" height="50" fill="#000" opacity="0.07" />
          <polygon points="36,76 62,76 57,66 41,66" fill="#e0d8c4" />
          <rect x="40" y="62" width="18" height="4" rx="1" fill="#d6cdb7" />
          <rect x="51" y="67.5" width="5" height="4" rx="1" fill="#5d7fa6" />
          <rect x="36" y="90" width="26" height="17" fill="#6f8db0" />
          <text x="49" y="101.6" className="lpfr-label">LAIT</text>
        </g>
        <g>
          <Contact cx={76} y={126} rx={8} />
          <polygon points="68,108 84,108 82.5,126 69.5,126" fill="#f5f0e6" stroke="#d9cfbc" strokeWidth="0.6" />
          <rect x="68.7" y="113" width="14.6" height="5" fill="#a9bd78" />
          <rect x="67" y="105.5" width="18" height="3.5" rx="1" fill="#cdc1a2" />
          <Contact cx={94} y={126} rx={8} />
          <polygon points="86,108 102,108 100.5,126 87.5,126" fill="#f5f0e6" stroke="#d9cfbc" strokeWidth="0.6" />
          <rect x="86.7" y="113" width="14.6" height="5" fill="#d99c96" />
          <rect x="85" y="105.5" width="18" height="3.5" rx="1" fill="#cdc1a2" />
        </g>
        <g>
          <Contact cx={120} y={126} rx={12} />
          <rect x="109" y="96" width="22" height="30" rx="4" fill="#8a2e3b" />
          <rect x="111.5" y="99" width="2.5" height="22" rx="1.2" fill="#fff" opacity="0.3" />
          <rect x="107" y="88" width="26" height="9" rx="2" fill="#c47c34" />
          <path d="M111 88v9M115 88v9M119 88v9M123 88v9M127 88v9M131 88v9" stroke="#000" strokeOpacity="0.16" strokeWidth="0.8" />
          <rect x="112" y="105" width="16" height="11" rx="1" fill="#f1e8d4" />
          <rect x="114.5" y="108.5" width="11" height="1.4" fill="#8a2e3b" opacity="0.6" />
          <rect x="116" y="111.6" width="8" height="1.2" fill="#b9ad92" />
        </g>
        <g>
          <Contact cx={154} y={126} rx={9} />
          <path d="M146 126V101c0-6 4.5-9 6-13V77h4v11c1.5 4 6 7 6 13v25z" fill="#9aa65a" />
          <rect x="151.2" y="70" width="5.6" height="8" rx="1" fill="#b8862e" />
          <rect x="148.5" y="101" width="1.8" height="21" rx="0.9" fill="#fff" opacity="0.3" />
          <rect x="146" y="105" width="16" height="14" fill="#efe5cc" />
          <rect x="149.5" y="109" width="9" height="1.6" fill="#8a7d5a" />
          <rect x="151" y="112.6" width="6" height="1.2" fill="#b9ad92" />
        </g>

        {/* Clayette du milieu : œufs (couvercle relevé), beurre entamé, demi-citron, tomate */}
        <Shelf y={230} />
        <g>
          <Contact cx={59} y={226} rx={26} />
          <polygon points="37,206 81,206 77,186 41,186" fill="#bcb091" />
          <ellipse cx="42.5" cy="207" rx="7" ry="8.6" fill="#efe3cc" />
          <ellipse cx="59" cy="207" rx="7" ry="8.6" fill="#dfc29d" />
          <ellipse cx="75.5" cy="207" rx="7" ry="8.6" fill="#f2e8d6" />
          <ellipse cx="40" cy="203.5" rx="2" ry="2.8" fill="#fff" opacity="0.55" />
          <ellipse cx="56.5" cy="203.5" rx="2" ry="2.8" fill="#fff" opacity="0.45" />
          <ellipse cx="73" cy="203.5" rx="2" ry="2.8" fill="#fff" opacity="0.55" />
          <path d="M34 214q8.3-5 16.7 0q8.3-5 16.6 0q8.4-5 16.7 0V226H34z" fill="#c8bc9f" />
          <path d="M50.7 214v12M67.3 214v12" stroke="#000" strokeOpacity="0.1" strokeWidth="0.8" />
        </g>
        <g>
          <Contact cx={108} y={226} rx={17} />
          <rect x="92" y="208" width="32" height="18" rx="2" fill="#f4ecc9" />
          <polygon points="92,208 104,208 92,217" fill="#e4d9ad" />
          <rect x="100" y="213" width="13" height="7" rx="1" fill="var(--accent)" opacity="0.75" />
          <rect x="118" y="208" width="6" height="18" rx="1" fill="#f3d978" />
        </g>
        <g>
          <Contact cx={140} y={226} rx={10} />
          <circle cx="140" cy="215" r="11" fill="#f5df84" stroke="#dfae2a" strokeWidth="2.6" />
          <circle cx="140" cy="215" r="8.2" fill="none" stroke="#fbf1c4" strokeWidth="1.1" />
          <path d="M140 215V207.6M140 215l5.2-5.2M140 215h7.4M140 215l5.2 5.2M140 215v7.4M140 215l-5.2 5.2M140 215h-7.4M140 215l-5.2-5.2" stroke="#e6c24e" strokeWidth="0.9" />
          <circle cx="140" cy="215" r="1.2" fill="#fbf1c4" />
        </g>
        <g>
          <Contact cx={165} y={226} rx={9} />
          <circle cx="165" cy="216" r="10" fill={`url(#${tomato})`} />
          <ellipse cx="161.5" cy="212" rx="2.6" ry="1.7" fill="#fff" opacity="0.4" />
          <path d="M165 206.5l2.2 2.6 3.2-.6-2 2.4 1.4 2.8-3-.9-1.8 2.3-1.8-2.3-3 .9 1.4-2.8-2-2.4 3.2.6z" fill="#5f7f36" />
        </g>

        {/* Clayette basse : fromage, reste de la veille (étiqueté à la main), moutarde */}
        <Shelf y={322} />
        <g>
          <Contact cx={60} y={318} rx={24} />
          <polygon points="80,296 84,292 84,314 80,318" fill="#c99236" />
          <polygon points="36,318 80,296 84,292 42,314" fill="#f5dc8a" />
          <polygon points="36,318 80,318 80,296" fill="#eccd6c" />
          <circle cx="70" cy="311" r="2.4" fill="#d4b052" />
          <circle cx="61" cy="315" r="1.5" fill="#d4b052" />
          <circle cx="75.5" cy="303.5" r="1.8" fill="#d4b052" />
        </g>
        <g>
          <Contact cx={115} y={318} rx={22} />
          <rect x="94" y="294" width="42" height="24" rx="3" className="lpfr-boxglass" />
          <rect x="96" y="300" width="38" height="16" rx="2" fill="#c06a32" />
          <circle cx="101" cy="304" r="1" fill="#e8b24a" />
          <circle cx="129" cy="309" r="1.1" fill="#e8b24a" />
          <circle cx="112" cy="313" r="0.9" fill="#7a9a46" />
          <rect x="92" y="288" width="46" height="7" rx="2.5" fill="#7a9a86" />
          <rect x="97" y="293" width="5" height="4" rx="1" fill="#62806d" />
          <rect x="128" y="293" width="5" height="4" rx="1" fill="#62806d" />
          <g transform="rotate(-5 115 306)">
            <rect x="103" y="302" width="24" height="8.5" fill="#f3ead2" opacity="0.94" />
            <text x="115" y="308.8" className="lpfr-hand">lundi ?</text>
          </g>
        </g>
        <g>
          <Contact cx={155} y={318} rx={10} />
          <rect x="146" y="299" width="18" height="19" rx="3" fill="#d7ad35" />
          <rect x="145" y="294" width="20" height="6" rx="1.5" fill="#2f3b2b" />
          <rect x="148" y="304" width="14" height="8.5" fill="#f2e9d3" />
          <rect x="150.5" y="307.4" width="9" height="1.3" fill="#a57f1f" />
        </g>

        {/* Bac à légumes : fond du tiroir, salade et carottes posées dessus, façade
            givrée plus basse que le dos (on voit le haut des légumes dépasser). */}
        <rect x="24" y="336" width="152" height="58" rx="8" className="lpfr-drawer" />
        <rect x="28" y="386" width="144" height="6" rx="3" className="lpfr-ceil" />
        <g>
          <ellipse cx="58" cy="390" rx="24" ry="2.2" className="lpfr-contact" />
          <ellipse cx="58" cy="371" rx="25" ry="19" fill="#86ab4e" />
          <ellipse cx="49" cy="359" rx="14" ry="12" fill="#9cbf62" />
          <ellipse cx="67" cy="357" rx="13" ry="11" fill="#a9c972" />
          <ellipse cx="58" cy="350" rx="10" ry="8" fill="#bcd684" />
          <path d="M58 389c-1-13-3-22-8-30M58 389c2-12 5-20 9-28M58 389c0-14 0-24 0-33" stroke="#e8f1cf" strokeOpacity="0.55" strokeWidth="1" fill="none" />
        </g>
        <g>
          <ellipse cx="128" cy="391" rx="32" ry="1.9" className="lpfr-contact" />
          <g transform="rotate(-9 124 383) translate(6 -10)">
            <path d="M98 380.5Q125 381.5 156 388Q125 391.5 98 390.5Q93.5 385.5 98 380.5z" fill={`url(#${carrot})`} />
            <path d="M107 382v7.6M117 382.6v7.2M127 383.6v6.2M137 384.8v4.8M146 386.2v3" stroke="#b35416" strokeOpacity="0.45" strokeWidth="0.8" />
            <path d="M98 384c-6-3-9-9-11-16M98 385c-8-1-13-5-17-11M98 386c-3-6-3-12 0-18" stroke="#5f8a34" strokeWidth="1.7" strokeLinecap="round" fill="none" />
          </g>
          <path d="M98 380.5Q125 381.5 156 388Q125 391.5 98 390.5Q93.5 385.5 98 380.5z" fill={`url(#${carrot})`} />
          <path d="M107 382v7.6M117 382.6v7.2M127 383.6v6.2M137 384.8v4.8M146 386.2v3" stroke="#b35416" strokeOpacity="0.45" strokeWidth="0.8" />
          <path d="M98 384c-6-3-9-9-11-16M98 385c-8-1-13-5-17-11M98 386c-3-6-3-12 0-18" stroke="#6f9a3e" strokeWidth="1.7" strokeLinecap="round" fill="none" />
        </g>
        <rect x="24" y="352" width="152" height="42" rx="8" className="lpfr-crisper" />
        <rect x="24" y="350" width="152" height="3" rx="1.5" className="lpfr-edge" />
        <rect x="80" y="359" width="40" height="4.5" rx="2.25" className="lpfr-edge" />

        {/* Porte entrouverte (charnière à droite) : face intérieure, tranche du
            bord libre, charnières, puis ses balconnets */}
        <polygon points={pts([doorPt(0, 8), doorPt(1, 8), doorPt(1, 412), doorPt(0, 412)])} className="lpfr-door" />
        <polygon points={pts([doorPt(0.08, 22), doorPt(0.92, 22), doorPt(0.92, 398), doorPt(0.08, 398)])} className="lpfr-doorin" />
        <polygon points={pts([doorPt(1, 8), [doorPt(1, 8)[0] + 6, doorPt(1, 8)[1] + 3], [doorPt(1, 412)[0] + 6, doorPt(1, 412)[1] - 3], doorPt(1, 412)])} className="lpfr-doorside" />
        <rect x="190" y="30" width="6" height="14" rx="2" className="lpfr-edge" />
        <rect x="190" y="376" width="6" height="14" rx="2" className="lpfr-edge" />
        <DoorBin y={112} items={[
          { t: 0.24, node: <><rect x="-4.5" y="-27" width="9" height="27" rx="2" fill="#a7392a" /><rect x="-2.5" y="-32" width="5" height="6" rx="1" fill="#2f3b2b" /></> },
          { t: 0.48, node: <><rect x="-6.5" y="-22" width="13" height="22" rx="3" fill="#ece0b4" /><rect x="-4" y="-26" width="8" height="5" rx="1" fill="var(--accent)" /></> },
          { t: 0.74, node: <><rect x="-6" y="-17" width="12" height="17" rx="3" fill="#d99a2b" /><rect x="-6.5" y="-21" width="13" height="4.5" rx="1.2" fill="#3c3a33" /></> },
        ]} />
        <DoorBin y={222} items={[
          { t: 0.26, node: <><rect x="-7.5" y="-40" width="15" height="40" fill="#e58e3c" /><polygon points="-7.5,-40 7.5,-40 4.5,-47 -4.5,-47" fill="#d9802f" /><circle cx="0" cy="-24" r="4" fill="#f4cf63" /></> },
          { t: 0.52, node: <><rect x="-6" y="-46" width="12" height="46" rx="3" fill="#cfe0e4" opacity="0.85" /><rect x="-3.5" y="-50" width="7" height="5" rx="1" fill="#4f86b0" /></> },
          { t: 0.76, node: <><rect x="-5" y="-19" width="10" height="19" rx="2" fill="#b9bdb5" /><rect x="-5" y="-13" width="10" height="7" fill="#c0392b" opacity="0.8" /></> },
        ]} />
        <DoorBin y={332} items={[
          { t: 0.3, node: <><rect x="-7.5" y="-66" width="15" height="66" rx="4" fill="#4a2230" /><rect x="-3" y="-82" width="6" height="18" fill="#4a2230" /><rect x="-3.5" y="-86" width="7" height="11" rx="1" fill="#8f2a3a" /><rect x="-7.5" y="-40" width="15" height="16" fill="#ece3cc" /></> },
          { t: 0.62, node: <><rect x="-4.5" y="-30" width="9" height="30" rx="2" fill="#efe9dc" /><rect x="-3.5" y="-34" width="7" height="5" rx="1" fill="#b8862e" /></> },
        ]} />
      </svg>

      <svg className="lp-fridge__q" viewBox="0 0 48 74" aria-hidden="true">
        <path
          className="lp-fridge__qstroke"
          pathLength="1"
          d="M9 23c-.6-10.4 8.2-17.6 18-17 10.2.6 16 7.4 15 15.6-.8 7-6.4 9.8-11.2 13.6-4 3.2-5.6 6.4-5.4 13.2"
        />
        <circle className="lp-fridge__qdot" cx="25.2" cy="64" r="4.7" />
      </svg>
    </div>
  );
}
