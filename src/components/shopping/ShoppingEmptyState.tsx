import { Icon } from "../ui/Icon.jsx";
import { EmptyArt } from "../ui/EmptyArt.jsx";

interface ShoppingEmptyStateProps {
  onCreate: () => void;
  onBrowseRecipes: () => void;
}

/**
 * État vide de la page Courses (aucune liste) : illustration, explication, et
 * deux points d'entrée (créer une liste libre, ou partir d'une recette).
 */
export function ShoppingEmptyState({ onCreate, onBrowseRecipes }: ShoppingEmptyStateProps) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px", maxWidth: 380, margin: "0 auto" }}>
      <EmptyArt name="panier" size={128} style={{ marginBottom: 8 }} />
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 7 }}>Aucune liste de courses</h3>
      <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 22 }}>
        Crée une liste libre pour noter tes achats,<br />ou envoie une recette aux courses depuis sa fiche.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={onCreate}>
          <Icon name="plus" size={16} color="#fff" /> Créer une liste
        </button>
        <button className="btn btn-ghost btn-pill btn-ghost-plain" style={{ fontSize: 14 }} onClick={onBrowseRecipes}>
          <Icon name="book" size={16} color="currentColor" /> Partir d'une recette
        </button>
      </div>
    </div>
  );
}
