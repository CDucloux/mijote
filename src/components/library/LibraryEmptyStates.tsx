import { Icon } from "../ui/Icon.jsx";
import { EmptyArt } from "../ui/EmptyArt.jsx";
import { ClearSearchButton } from "../ui/ClearSearchButton.jsx";

interface LibraryWelcomeProps {
  onNewRecipe: () => void;
  /** Ouvre l'accueil (recettes publiques) ; bouton masqué si absent. */
  onExplore?: () => void;
}

/** Première connexion : bibliothèque vide, on invite sans afficher « Carnets » ni « Recettes (0) ». */
export function LibraryWelcome({ onNewRecipe, onExplore }: LibraryWelcomeProps) {
  return (
    <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px", maxWidth: 420, margin: "0 auto" }}>
      <EmptyArt name="bibliotheque" size={140} style={{ marginBottom: 10 }} />
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 8 }}>Bienvenue dans ta bibliothèque</h3>
      <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 24 }}>
        Elle est encore vide. Crée ta première recette ou pioche l'inspiration parmi les recettes partagées par la communauté.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
        <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={onNewRecipe}>
          <Icon name="plus" size={16} color="#fff" /> Créer ma première recette
        </button>
        {onExplore && (
          <button className="btn btn-ghost btn-pill btn-ghost-plain" style={{ fontSize: 14 }} onClick={onExplore}>
            <Icon name="sparkle" size={16} color="var(--accent)" /> Explorer les recettes publiques
          </button>
        )}
      </div>
    </div>
  );
}

interface NoRecipeResultsProps {
  /** Recherche courante (non nettoyée). */
  search: string;
  /** Des filtres ou un carnet restreignent la vue. */
  hasFilters: boolean;
  onReset: () => void;
  onSearchCommunity?: (query: string) => void;
  onCreate: (name: string) => void;
}

/** Recherche ou filtres sans résultat : chercher ailleurs, créer la recette ou tout réinitialiser. */
export function NoRecipeResults({ search, hasFilters, onReset, onSearchCommunity, onCreate }: NoRecipeResultsProps) {
  const q = search.trim();
  const qShort = q.length > 22 ? q.slice(0, 22) + "…" : q;
  return (
    <div style={{ minHeight: "48vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px", maxWidth: 380, margin: "0 auto" }}>
      <EmptyArt name="loupe" size={116} style={{ marginBottom: 6 }} />
      <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", marginBottom: 7 }}>Aucune recette trouvée</h3>
      <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.5, marginBottom: 22 }}>
        {q
          ? <>Rien ne correspond à « <strong style={{ color: "var(--text)", fontWeight: 600 }}>{qShort}</strong> » dans ta bibliothèque.<br />Cherche-la dans la communauté ou crée-la.</>
          : "Aucune recette ne correspond à ces filtres."}
      </p>

      {q ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {onSearchCommunity && (
            <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={() => onSearchCommunity(q)}>
              <Icon name="sparkle" size={16} color="#fff" /> Chercher dans la communauté
            </button>
          )}
          <button className="btn btn-ghost btn-pill btn-ghost-plain" style={{ fontSize: 14 }} onClick={() => onCreate(q)}>
            <Icon name="plus" size={16} color="currentColor" /> Créer « {qShort} »
          </button>
        </div>
      ) : hasFilters && (
        <button className="btn btn-primary btn-pill" style={{ fontSize: 14 }} onClick={onReset}>
          <Icon name="close" size={15} color="#fff" /> Enlever les filtres
        </button>
      )}

      {/* Reset discret quand une recherche est active (les CTA principaux vont de
          l'avant ; ce lien reste la porte de retour vers la bibliothèque). */}
      {q && <ClearSearchButton onClick={onReset} label={hasFilters ? "Réinitialiser recherche et filtres" : undefined} style={{ marginTop: 16 }} />}
    </div>
  );
}
