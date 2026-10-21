import { memo, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "../ui/Icon.jsx";
import { EmptyArt } from "../ui/EmptyArt.jsx";
import { jarFillColor, jarVessel, type JarIngredient } from "@/lib/food/jarLook.js";
import type { StockLevel } from "@/lib/food/stockLevel.js";
import { useLongPress } from "../../hooks/useLongPress.js";
import { useImageState } from "../../hooks/useImageState.js";

/** État d'un bocal : plein (en stock), bientôt vide, ou vide (à racheter). */
export type JarState = StockLevel;

const STATE_LABEL: Record<JarState, string> = { full: "en stock", low: "bientôt vide", empty: "à racheter" };

/** Ingrédient posé sur l'étagère (fiche de la base). */
export type ShelfIngredient = JarIngredient & { image?: string };

interface JarProps {
  ing: ShelfIngredient;
  state: JarState;
  onCycle: (id: string) => void;
  /** Appui long : ouvre le menu du bocal. */
  onHold: (id: string) => void;
  /** Rayon : choisit le contenant (bouteille, pot à épices, bocal) et sa teinte. */
  catKey: string;
}

/**
 * Un bocal. Mémoïsé sur `(ing, state, onCycle)` : toggler un bocal ne re-rend que
 * lui, pas les 139. Le niveau de remplissage est piloté en CSS par `data-state`.
 * Tap : niveau suivant du cycle ; appui long : menu du bocal (`onHold`).
 */
export const Jar = memo(function Jar({ ing, state, onCycle, onHold, catKey }: JarProps) {
  const { loaded, err, imgRef, onLoad, onError } = useImageState(ing.image);
  const { startLongPress, cancelLongPress, moveLongPress, wasLongPress } = useLongPress();
  const vessel = jarVessel(catKey);
  return (
    <button
      className="stk-jar"
      data-state={state}
      data-vessel={vessel?.kind}
      onClick={() => { if (!wasLongPress()) onCycle(ing.id); }}
      onPointerDown={e => startLongPress(e, () => onHold(ing.id))}
      onPointerMove={moveLongPress}
      onPointerUp={cancelLongPress}
      onPointerLeave={cancelLongPress}
      onPointerCancel={cancelLongPress}
      onContextMenu={e => e.preventDefault()}
      style={{ "--fill": jarFillColor(ing, catKey) } as CSSProperties}
      aria-label={`${ing.name} : ${STATE_LABEL[state]}`}
    >
      <span className="stk-lid" aria-hidden="true" />
      <span className="stk-glass ripple ripple-accent">
        <span className="stk-fill" />
        <span className="stk-photo" aria-hidden="true">
          {ing.image && !err && !loaded && <span className="ing-img-spinner" role="status" aria-label="Chargement" />}
          {ing.image && !err
            ? <img ref={imgRef} src={ing.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
                className="ing-img-reveal" data-loaded={loaded ? "1" : undefined} onLoad={onLoad} onError={onError} />
            : <Icon name="photo" size={22} color="#b3afaa" />}
        </span>
        <span className="stk-gloss" aria-hidden="true" />
        <span className="stk-label"><span>{ing.name}</span></span>
      </span>
      {state !== "empty" && (
        <span className="stk-badge" data-state={state}>
          <Icon name={state === "low" ? "warning" : "check"} size={state === "low" ? 12 : 11} color="#fff" />
        </span>
      )}
    </button>
  );
}, (a: JarProps, b: JarProps) => a.state === b.state && a.ing === b.ing && a.onCycle === b.onCycle && a.onHold === b.onHold && a.catKey === b.catKey);

/** Équerre vue de FACE (comme l'étagère) : on n'en voit que la tranche, une barre
 *  étroite qui descend sous la planche et s'affine vers le mur, avec sa vis de
 *  fixation. Décalée du bord (cf. .stk-bracket). L'ombre portée est une silhouette
 *  décalée dessinée dans le SVG : un `filter: drop-shadow` coûterait une passe hors
 *  écran par équerre à chaque peinture. */
const BRACKET_PATH = "M0.5 0H9.5L7.6 27.2C7.4 29 6.4 30 5 30C3.6 30 2.6 29 2.4 27.2Z";
function ShelfBracket({ side }: { side: "l" | "r" }) {
  return (
    <svg className={`stk-bracket ${side}`} viewBox="0 0 10 30" fill="none" aria-hidden="true">
      <path d={BRACKET_PATH} transform="translate(0.8 2.6)" fill="rgba(30, 20, 10, 0.2)" />
      <path d={BRACKET_PATH} fill="var(--iron)" />
      <path d="M0.5 0H3L3.8 26.5C3.2 26.5 2.6 26.9 2.4 27.2Z" fill="rgba(255,255,255,.09)" />
      <circle cx="5" cy="21" r="1.3" fill="var(--iron-hi)" />
    </svg>
  );
}

// Feuilles du brin : position (base sur la tige), angle, longueur, largeur, teinte.
// Tailles et teintes irrégulières : un vrai brin n'est jamais symétrique.
const SPRIG_LEAVES = [
  { x: 27.4, y: 60, r: -58, l: 13, w: 7.5, c: "#6d9447" },
  { x: 27.6, y: 56, r: 62, l: 12, w: 7, c: "#7fa155" },
  { x: 26.6, y: 48, r: -48, l: 14, w: 8, c: "#7fa155" },
  { x: 27, y: 44, r: 52, l: 12.5, w: 7, c: "#8cae60" },
  { x: 26.2, y: 36, r: -40, l: 12, w: 6.8, c: "#8cae60" },
  { x: 26.6, y: 32, r: 44, l: 11, w: 6.2, c: "#9cbb73" },
  { x: 26.4, y: 25, r: -22, l: 9, w: 5.4, c: "#a6c47f" },
  { x: 26.8, y: 23, r: 26, l: 8, w: 5, c: "#a6c47f" },
  { x: 33.5, y: 47, r: 70, l: 9.5, w: 5.6, c: "#9cbb73" },
  { x: 37, y: 41.5, r: 30, l: 8.5, w: 5, c: "#a6c47f" },
];
const leafPath = (l: number, w: number) => `M0 0C${w / 2} ${-l * 0.28} ${w / 2} ${-l * 0.72} 0 ${-l}C${-w / 2} ${-l * 0.72} ${-w / 2} ${-l * 0.28} 0 0Z`;

/** Fioriture unique : un brin dans son pot de terre cuite, posé en bout de rayon (décoratif). */
export function ShelfSprig() {
  return (
    <svg className="stk-sprig" viewBox="0 0 54 96" aria-hidden="true">
      {/* tige principale et rameau */}
      <path d="M28 68C27.4 56 26 44 26.5 21" stroke="#56773a" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M27.2 52C31 49 34.5 45 37.5 40" stroke="#56773a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {SPRIG_LEAVES.map((leaf, i) => (
        <g key={i} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r})`}>
          <path d={leafPath(leaf.l, leaf.w)} fill={leaf.c} />
          <path d={`M0 -1.5V${-leaf.l * 0.8}`} stroke="rgba(40,60,25,.28)" strokeWidth="0.7" strokeLinecap="round" />
        </g>
      ))}
      {/* pot : corps évasé, rebord, ombre du côté droit */}
      <path d="M14 72H42L39 93C38.8 94.7 37.6 96 35.9 96H20.1C18.4 96 17.2 94.7 17 93Z" fill="#c8693f" />
      <path d="M33 72H42L39 93C38.8 94.7 37.6 96 35.9 96H32Z" fill="#a9532f" />
      <rect x="11" y="66" width="34" height="8" rx="2.5" fill="#d9804f" />
      <rect x="11" y="66" width="34" height="2.4" rx="1.2" fill="#e89a6b" />
    </svg>
  );
}

/**
 * État vide centré et soigné (titre + texte + action), calqué sur l'état
 * « aucune recette » de la bibliothèque pour l'homogénéité. En tête, soit un
 * croquis animé « à l'encre » (`art`, prioritaire, comme les autres écrans),
 * soit à défaut une pastille d'icône.
 */
interface StockEmptyProps {
  icon?: IconName;
  art?: string;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}

export function StockEmpty({ icon = "box", art, title, body, action }: StockEmptyProps) {
  return (
    <div style={{ minHeight: "48vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24, maxWidth: 380, margin: "0 auto" }}>
      {art ? (
        <EmptyArt name={art} size={116} style={{ marginBottom: 6 }} />
      ) : (
        <div style={{ width: 76, height: 76, borderRadius: 22, background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18, boxShadow: "0 8px 24px -16px rgba(0,0,0,0.35)" }}>
          <Icon name={icon} size={30} color="var(--accent)" />
        </div>
      )}
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 7 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: action ? 22 : 0 }}>{body}</p>
      {action}
    </div>
  );
}

/** La planche et ses deux équerres, sous chaque rangée de bocaux. */
export function ShelfBoard() {
  return (
    <div className="stk-board">
      <ShelfBracket side="l" />
      <ShelfBracket side="r" />
    </div>
  );
}

/** Une planche « fantôme » : `n` bocaux squelette posés sur un vrai rayon. */
function SkelShelf({ n }: { n: number }) {
  return (
    <div className="stk-shelf">
      <div className="stk-jars">
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} className="stk-jar" aria-hidden="true">
            <span className="stk-skel-lid skeleton" />
            <span className="stk-skel-glass skeleton" />
          </div>
        ))}
      </div>
      <ShelfBoard />
    </div>
  );
}

/**
 * Squelette du mur affiché pendant l'hydratation : deux rayons peuplés, un dernier
 * partiel, pour donner d'emblée la forme de l'étagère plutôt qu'un écran vide.
 */
export function StockWallSkeleton({ perRow }: { perRow: number }) {
  const p = Math.max(1, perRow);
  const partial = Math.max(2, Math.min(p, Math.round(p * 0.6)));
  return (
    <div aria-hidden="true" aria-busy="true">
      <div className="stk-group">
        <div className="skeleton" style={{ width: 150, height: 28, borderRadius: 8, margin: "0 0 12px 4px" }} />
        <SkelShelf n={p} />
        <SkelShelf n={p} />
      </div>
      <div className="stk-group">
        <div className="skeleton" style={{ width: 104, height: 28, borderRadius: 8, margin: "0 0 12px 4px" }} />
        <SkelShelf n={partial} />
      </div>
    </div>
  );
}
