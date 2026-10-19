import { Icon } from "../ui/Icon.jsx";
import "../../styles/landing-import.css";

/** Glyphe « texte » de l'onglet Texte, identique à celui de l'écran d'import. */
function TextGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 11h16M4 16h10" />
    </svg>
  );
}

// Les quatre sources de l'écran d'import réel, chacune avec la recette qu'elle
// produit. La scène les parcourt en boucle (même ordre que le contrôle segmenté).
const SOURCES = [
  {
    key: "lien", label: "Lien", icon: "link",
    recipe: { title: "Tarte au citron meringuée", time: "1 h 15", serves: "8 pers.", ings: ["3 citrons", "150 g sucre", "4 œufs", "90 g beurre"], sub: "Pâte sablée" },
  },
  {
    key: "photo", label: "Photo", icon: "photo",
    recipe: { title: "Blanquette de veau", time: "2 h", serves: "6 pers.", ings: ["1 kg veau", "2 carottes", "250 g champignons", "20 cl crème"], sub: "Roux blanc" },
  },
  {
    key: "texte", label: "Texte", icon: null,
    recipe: { title: "Gnocchis à la sauge", time: "40 min", serves: "4 pers.", ings: ["800 g pommes de terre", "200 g farine", "1 œuf", "12 feuilles de sauge"], sub: "Beurre noisette" },
  },
  {
    key: "pdf", label: "PDF", icon: "pdf",
    recipe: { title: "Tarte Tatin", time: "1 h", serves: "6 pers.", ings: ["6 pommes", "120 g sucre", "80 g beurre"], sub: "Pâte brisée" },
  },
];

/** Ce que l'utilisateur fournit, par source : un lien saisi, deux pages de livre
 *  photographiées, un texte collé, un PDF déposé. */
function SourceInput({ kind }) {
  if (kind === "lien") {
    return (
      <div className="lp-imx__field">
        <Icon name="link" size={13} color="var(--text3)" />
        <span className="lp-imx__typed">marmiton.org/recettes/tarte-au-citron</span>
      </div>
    );
  }
  if (kind === "photo") {
    return (
      <div className="lp-imx__pages">
        {[0, 1].map((p) => (
          <span key={p} className={`lp-imx__page lp-imx__page--${p}`}>
            {p === 0 && <i className="lp-imx__pic" />}
            <i className="lp-imx__ln" style={{ width: "78%" }} />
            <i className="lp-imx__ln" style={{ width: "92%" }} />
            <i className="lp-imx__ln" style={{ width: "64%" }} />
            {p === 1 && <><i className="lp-imx__ln" style={{ width: "86%" }} /><i className="lp-imx__ln" style={{ width: "70%" }} /></>}
          </span>
        ))}
        <span className="lp-imx__count">2 pages</span>
      </div>
    );
  }
  if (kind === "texte") {
    return (
      <p className="lp-imx__paste">
        Gnocchis à la sauge, pour 4. Cuire 800 g de pommes de terre en robe des champs,
        les écraser, ajouter 200 g de farine et un œuf…
      </p>
    );
  }
  return (
    <div className="lp-imx__pdf">
      <span className="lp-imx__pdfic"><Icon name="pdf" size={16} color="var(--accent)" /></span>
      <span className="lp-imx__pdfmeta"><b>tarte-tatin.pdf</b><small>Prêt à extraire</small></span>
    </div>
  );
}

/** La recette structurée qui sort de l'import : titre, temps et portions,
 *  ingrédients quantifiés, sous-recette détectée, étapes. */
function RecipeOut({ recipe }) {
  return (
    <div className="lp-imx__recipe">
      <div className="lp-imx__title">{recipe.title}</div>
      <div className="lp-imx__meta">
        <span><Icon name="clock" size={11} color="var(--text3)" /> {recipe.time}</span>
        <span><Icon name="portions" size={11} color="var(--text3)" /> {recipe.serves}</span>
      </div>
      <div className="lp-imx__chips">
        {recipe.ings.map((ing, i) => (
          <span key={ing} className="lp-imx__chip" style={{ "--i": i }}>{ing}</span>
        ))}
        <span className="lp-imx__chip lp-imx__chip--sub" style={{ "--i": recipe.ings.length }}>
          <Icon name="layers" size={10} color="currentColor" /> {recipe.sub}
        </span>
      </div>
      <div className="lp-imx__steps">
        {[88, 74, 81].map((w, i) => (
          <span key={i} className="lp-imx__step" style={{ "--i": i }}>
            <b>{i + 1}</b><i style={{ width: `${w}%` }} />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Démo de l'import intelligent, fidèle à l'écran réel : en-tête « Importer »,
 * contrôle segmenté Lien / Photo / Texte / PDF, champ propre à chaque source, CTA
 * « Extraire » et recette structurée en sortie. Les quatre sources défilent en
 * boucle (100% CSS, la première seule reste affichée si mouvement réduit).
 */
export function ImportScene() {
  return (
    <div className="lp-scene lp-imx" aria-hidden="true">
      <div className="lp-imx__hdr">
        <span className="lp-imx__back"><Icon name="back" size={12} color="var(--text2)" /></span>
        <span className="lp-imx__h">Importer</span>
      </div>
      <div className="lp-imx__seg">
        <span className="lp-imx__thumb" />
        {SOURCES.map((s, k) => (
          <span key={s.key} className="lp-imx__tab" style={{ "--k": k }}>
            {s.icon ? <Icon name={s.icon} size={14} color="currentColor" /> : <TextGlyph />}
            {s.label}
          </span>
        ))}
      </div>
      <div className="lp-imx__stage">
        {SOURCES.map((s, k) => (
          <div key={s.key} className="lp-imx__pane" style={{ "--k": k }}><SourceInput kind={s.key} /></div>
        ))}
      </div>
      <div className="lp-imx__run">
        <span className="lp-imx__cta"><Icon name="sparkle" size={13} color="#fff" /> Extraire</span>
        <span className="lp-imx__track"><i /></span>
      </div>
      <div className="lp-imx__out">
        {SOURCES.map((s, k) => (
          <div key={s.key} className="lp-imx__result" style={{ "--k": k }}><RecipeOut recipe={s.recipe} /></div>
        ))}
      </div>
    </div>
  );
}
