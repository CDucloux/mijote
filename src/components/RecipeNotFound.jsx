import { EmptyArt } from "./EmptyArt.jsx";
import { Icon } from "./Icon.jsx";

// État « recette introuvable » : lien mort (recette supprimée, id inconnu). On
// reste dans le langage graphique des autres écrans vides (croquis à l'encre,
// titre serif, bouton pill) et on ne montre AUCUN détail technique (pas de code
// 404) : côté utilisateur, c'est juste une recette qui n'existe pas.
export function RecipeNotFound({ onBack }) {
  return (
    <div className="editor-enter" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: "40px 32px", textAlign: "center" }}>
      <EmptyArt name="loupe" size={132} />
      <div>
        <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 8px" }}>Recette introuvable</h2>
        <p style={{ fontSize: 14.5, color: "var(--text2)", lineHeight: 1.6, maxWidth: 300, margin: "0 auto" }}>
          Ce lien ne mène à aucune recette de tes carnets. Elle a peut-être été supprimée.
        </p>
      </div>
      <button onClick={onBack} className="btn btn-primary btn-pill" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <Icon name="arrowLeft" size={15} color="#fff" /> Retour aux recettes
      </button>
    </div>
  );
}
