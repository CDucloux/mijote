import { Icon } from "../Icon.jsx";
import { EmptyArt } from "../EmptyArt.jsx";

/**
 * État vide de la page Courses (aucune liste) : illustration, explication, et
 * deux points d'entrée (créer une liste libre, ou partir d'une recette).
 */
export function ShoppingEmptyState({ onCreate, onBrowseRecipes }) {
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
        <button className="btn btn-pill" style={{ fontSize: 14, background: "var(--surface)", color: "var(--text2)", border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", transition: "border-color 0.15s ease" }} onClick={onBrowseRecipes}
          onMouseEnter={e => e.currentTarget.style.borderColor = "var(--text3)"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
          <Icon name="book" size={16} color="currentColor" /> Partir d'une recette
        </button>
      </div>
    </div>
  );
}
