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

        {/* Pieds, carrosserie */}
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
          <Contact cx={47} y={126} rx={14} />
          <rect x="34" y="76" width="26" height="50" rx="1.5" fill="#ece6d6" />
          <rect x="53" y="76" width="7" height="50" fill="#000" opacity="0.07" />
          <polygon points="34,76 60,76 55,66 39,66" fill="#e0d8c4" />
          <rect x="38" y="62" width="18" height="4" rx="1" fill="#d6cdb7" />
          <rect x="49" y="67.5" width="5" height="4" rx="1" fill="#5d7fa6" />
          <rect x="34" y="90" width="26" height="17" fill="#6f8db0" />
          <text x="47" y="101.6" className="lpfr-label">LAIT</text>
        </g>
        <g>
          <Contact cx={75} y={126} rx={8} />
          <polygon points="67,108 83,108 81.5,126 68.5,126" fill="#f5f0e6" stroke="#d9cfbc" strokeWidth="0.6" />
          <rect x="67.7" y="113" width="14.6" height="5" fill="#a9bd78" />
          <rect x="66" y="105.5" width="18" height="3.5" rx="1" fill="#cdc1a2" />
          <Contact cx={94} y={126} rx={8} />
          <polygon points="86,108 102,108 100.5,126 87.5,126" fill="#f5f0e6" stroke="#d9cfbc" strokeWidth="0.6" />
          <rect x="86.7" y="113" width="14.6" height="5" fill="#d99c96" />
          <rect x="85" y="105.5" width="18" height="3.5" rx="1" fill="#cdc1a2" />
        </g>
        <g>
          <Contact cx={125} y={126} rx={12} />
          <rect x="114" y="96" width="22" height="30" rx="4" fill="#8a2e3b" />
          <rect x="116.5" y="99" width="2.5" height="22" rx="1.2" fill="#fff" opacity="0.3" />
          <rect x="112" y="88" width="26" height="9" rx="2" fill="#c47c34" />
          <path d="M116 88v9M120 88v9M124 88v9M128 88v9M132 88v9M136 88v9" stroke="#000" strokeOpacity="0.16" strokeWidth="0.8" />
          <rect x="117" y="105" width="16" height="11" rx="1" fill="#f1e8d4" />
          <rect x="119.5" y="108.5" width="11" height="1.4" fill="#8a2e3b" opacity="0.6" />
          <rect x="121" y="111.6" width="8" height="1.2" fill="#b9ad92" />
        </g>
        <g>
          <Contact cx={156} y={126} rx={9} />
          <path d="M148 126V101c0-6 4.5-9 6-13V77h4v11c1.5 4 6 7 6 13v25z" fill="#9aa65a" />
          <rect x="153.2" y="70" width="5.6" height="8" rx="1" fill="#b8862e" />
          <rect x="150.5" y="101" width="1.8" height="21" rx="0.9" fill="#fff" opacity="0.3" />
          <rect x="148" y="105" width="16" height="14" fill="#efe5cc" />
          <rect x="151.5" y="109" width="9" height="1.6" fill="#8a7d5a" />
          <rect x="153" y="112.6" width="6" height="1.2" fill="#b9ad92" />
        </g>

        {/* Clayette du milieu : boîte d'œufs entamée, beurre, demi-citron */}
        <Shelf y={230} />
        <g>
          <Contact cx={59} y={226} rx={26} />
          <rect x="36" y="187" width="46" height="25" rx="4" fill="#cdc2a3" />
          <rect x="39" y="190" width="40" height="19" rx="2.5" fill="#000" opacity="0.06" />
          <text x="59" y="196" className="lpfr-tiny">6 ŒUFS FRAIS</text>
          <ellipse cx="42.5" cy="207" rx="7" ry="8.6" fill="#f2e9d8" />
          <ellipse cx="59" cy="207" rx="7" ry="8.6" fill="#ddbe98" />
          <ellipse cx="40" cy="203.5" rx="2" ry="2.8" fill="#fff" opacity="0.6" />
          <ellipse cx="56.5" cy="203.5" rx="2" ry="2.8" fill="#fff" opacity="0.4" />
          <rect x="33" y="211" width="52" height="4" rx="1.5" fill="#d6cbae" />
          <ellipse cx="75.5" cy="212.4" rx="6.2" ry="1.6" fill="#000" opacity="0.18" />
          <path d="M34 215h16.7v3.5a8.35 7.5 0 0 1-16.7 0zM50.7 215h16.6v3.5a8.3 7.5 0 0 1-16.6 0zM67.3 215H84v3.5a8.35 7.5 0 0 1-16.7 0z" fill="#c8bc9f" />
          <path d="M50.7 215v7M67.3 215v7" stroke="#000" strokeOpacity="0.12" strokeWidth="0.8" />
        </g>
        <g>
          <Contact cx={111} y={226} rx={17} />
          <rect x="95" y="208" width="32" height="18" rx="2" fill="#f4ecc9" />
          <polygon points="95,208 107,208 95,217" fill="#e4d9ad" />
          <rect x="103" y="213" width="13" height="7" rx="1" fill="var(--accent)" opacity="0.75" />
          <rect x="121" y="208" width="6" height="18" rx="1" fill="#f3d978" />
        </g>
        <g>
          <Contact cx={150} y={226} rx={10} />
          <circle cx="150" cy="215" r="11" fill="#f5df84" stroke="#dfae2a" strokeWidth="2.6" />
          <circle cx="150" cy="215" r="8.2" fill="none" stroke="#fbf1c4" strokeWidth="1.1" />
          <path d="M150 215V207.6M150 215l5.2-5.2M150 215h7.4M150 215l5.2 5.2M150 215v7.4M150 215l-5.2 5.2M150 215h-7.4M150 215l-5.2-5.2" stroke="#e6c24e" strokeWidth="0.9" />
          <circle cx="150" cy="215" r="1.2" fill="#fbf1c4" />
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

        {/* Bac à légumes : fond du tiroir, salade, carottes et tomate posées dessus, façade
            givrée plus basse que le dos (on voit le haut des légumes dépasser). */}
        <rect x="24" y="336" width="152" height="58" rx="8" className="lpfr-drawer" />
        <rect x="28" y="386" width="144" height="6" rx="3" className="lpfr-ceil" />
        <g>
          <ellipse cx="58" cy="390" rx="23" ry="2.2" className="lpfr-contact" />
          <ellipse cx="58" cy="376" rx="24" ry="14.5" fill="#86ab4e" />
          <ellipse cx="49" cy="367" rx="13" ry="10" fill="#9cbf62" />
          <ellipse cx="67" cy="366" rx="12" ry="9.5" fill="#a9c972" />
          <ellipse cx="58" cy="361" rx="9" ry="6.5" fill="#bcd684" />
          <path d="M58 389c-1-10-3-17-8-24M58 389c2-9 5-16 9-22M58 389c0-11 0-19 0-26" stroke="#e8f1cf" strokeOpacity="0.55" strokeWidth="1" fill="none" />
        </g>
        {/* Deux carottes posées au fond, la seconde un peu plus loin (donc plus haut) */}
        <g transform="translate(-4 -4)">
          <ellipse cx="127" cy="390.6" rx="30" ry="1.7" className="lpfr-contact" />
          <path d="M98 380.5Q125 381.5 156 388Q125 391.5 98 390.5Q93.5 385.5 98 380.5z" fill={`url(#${carrot})`} />
            <path d="M107 382v7.6M117 382.6v7.2M127 383.6v6.2M137 384.8v4.8M146 386.2v3" stroke="#b35416" strokeOpacity="0.45" strokeWidth="0.8" />
            <path d="M98 384c-6-3-9-9-11-16M98 385c-8-1-13-5-17-11M98 386c-3-6-3-12 0-18" stroke="#5f8a34" strokeWidth="1.7" strokeLinecap="round" fill="none" />
        </g>
        <g transform="translate(-8 0)">
          <ellipse cx="127" cy="390.8" rx="31" ry="1.9" className="lpfr-contact" />
          <path d="M98 380.5Q125 381.5 156 388Q125 391.5 98 390.5Q93.5 385.5 98 380.5z" fill={`url(#${carrot})`} />
            <path d="M107 382v7.6M117 382.6v7.2M127 383.6v6.2M137 384.8v4.8M146 386.2v3" stroke="#b35416" strokeOpacity="0.45" strokeWidth="0.8" />
            <path d="M98 384c-6-3-9-9-11-16M98 385c-8-1-13-5-17-11M98 386c-3-6-3-12 0-18" stroke="#6f9a3e" strokeWidth="1.7" strokeLinecap="round" fill="none" />
        </g>
        <g>
          <ellipse cx="163" cy="390.4" rx="9" ry="1.8" className="lpfr-contact" />
          <circle cx="163" cy="381" r="9.4" fill={`url(#${tomato})`} />
          <ellipse cx="159.8" cy="377.2" rx="2.4" ry="1.6" fill="#fff" opacity="0.4" />
          <path d="M163 371.8l2.1 2.4 3-.6-1.9 2.3 1.3 2.6-2.8-.8-1.7 2.1-1.7-2.1-2.8.8 1.3-2.6-1.9-2.3 3 .6z" fill="#5f7f36" />
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
          { t: 0.24, node: <><path d="M-4 0v-16c0-3 2-4 2.6-7v-5h2.8v5c.6 3 2.6 4 2.6 7V0z" fill="#b23a26" /><rect x="-1.6" y="-33" width="3.2" height="5.5" rx="1" fill="#2f3b2b" /><rect x="-4" y="-13" width="8" height="7" fill="#f1e3c2" /><rect x="-2.5" y="-10.4" width="5" height="1.1" fill="#b23a26" /></> },
          { t: 0.5, node: <><rect x="-6" y="-24" width="12" height="20" rx="4" fill="#c9372a" /><rect x="-4" y="-4" width="8" height="4" rx="1" fill="#f3ead2" /><rect x="-6" y="-18" width="12" height="7" fill="#f6e7c8" /><circle cx="0" cy="-14.5" r="1.7" fill="#c9372a" /><rect x="-4.2" y="-22" width="1.4" height="14" rx="0.7" fill="#fff" opacity="0.3" /></> },
          { t: 0.76, node: <><rect x="-6" y="-16" width="12" height="16" rx="3" fill="#e2a23a" /><rect x="-6.5" y="-19.5" width="13" height="4" rx="1" fill="#3c3a33" /><polygon points="0,-11.2 2.8,-9.6 2.8,-6.4 0,-4.8 -2.8,-6.4 -2.8,-9.6" fill="#f6e6b8" /><rect x="-4.3" y="-14" width="1.3" height="12" rx="0.6" fill="#fff" opacity="0.3" /></> },
        ]} />
        <DoorBin y={222} items={[
          { t: 0.26, node: <><rect x="-7.5" y="-40" width="15" height="40" fill="#ef9a3e" /><rect x="3" y="-40" width="4.5" height="40" fill="#000" opacity="0.08" /><polygon points="-7.5,-40 7.5,-40 4.5,-47 -4.5,-47" fill="#e2872f" /><rect x="0.5" y="-46" width="4" height="3" rx="0.8" fill="#2f7d4a" /><circle cx="0" cy="-23" r="5" fill="#f6c25a" stroke="#e7882a" strokeWidth="1" /><path d="M0-23v-4M0-23l3.4-2M0-23l3.4 2M0-23v4M0-23l-3.4 2M0-23l-3.4-2" stroke="#e7882a" strokeWidth="0.6" /><rect x="-7.5" y="-12" width="15" height="4" fill="#2f7d4a" opacity="0.85" /></> },
          { t: 0.52, node: <><rect x="-2.8" y="-49" width="5.6" height="6" fill="#d6e7ec" /><rect x="-3.2" y="-53" width="6.4" height="4.5" rx="1" fill="#4f86b0" /><rect x="-6" y="-44" width="12" height="44" rx="3.5" fill="#d6e7ec" opacity="0.9" /><path d="M-6-35h12M-6-31h12M-6-8h12M-6-4h12" stroke="#fff" strokeOpacity="0.7" strokeWidth="0.7" /><rect x="-6" y="-24" width="12" height="8" fill="#4f86b0" opacity="0.85" /></> },
          { t: 0.77, node: <><rect x="-5" y="-19" width="10" height="19" rx="2" fill="#c9ccc7" /><ellipse cx="0" cy="-19" rx="5" ry="1.2" fill="#e4e6e2" /><rect x="-5" y="-14" width="10" height="8" fill="#c0392b" /><rect x="-3.6" y="-17" width="1.2" height="15" rx="0.6" fill="#fff" opacity="0.35" /></> },
        ]} />
        <DoorBin y={332} items={[
          { t: 0.3, node: <><path d="M-7.5 0v-48c0-6 4.5-8 4.5-14v-20h6v20c0 6 4.5 8 4.5 14V0z" fill="#3d1c27" /><rect x="-3.4" y="-88" width="6.8" height="12" rx="1" fill="#8f2a3a" /><rect x="-5.2" y="-46" width="1.6" height="40" rx="0.8" fill="#fff" opacity="0.18" /><rect x="-7.5" y="-34" width="15" height="17" fill="#ece3cc" /><circle cx="0" cy="-28.5" r="2.4" fill="none" stroke="#8f2a3a" strokeWidth="0.8" /><rect x="-4.5" y="-23" width="9" height="1.2" fill="#8a7d5a" /></> },
          { t: 0.64, node: <><path d="M-5.5 0v-20c0-3 2-4 2.2-7v-6h6.6v6c.2 3 2.2 4 2.2 7V0z" fill="#f4f1ea" stroke="#d9d3c4" strokeWidth="0.6" /><rect x="-3.6" y="-36.5" width="7.2" height="4" rx="1" fill="#4f86b0" /><rect x="-5.5" y="-14" width="11" height="6" fill="#4f86b0" opacity="0.8" /></> },
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
