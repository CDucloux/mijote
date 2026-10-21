import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { RecipeDetail } from "../../pages/RecipeDetail.jsx";
import { RecipeNotFound } from "../recipe/RecipeNotFound.jsx";
import { deletePublicRecipe, reportPublicRecipe } from "@/lib/firebase/community.js";
import type { PublicDoc } from "@/lib/household/publicRecipes.js";
import type { DbEntry } from "@/lib/food/nameMatcher.js";
import type { CategoryMap } from "@/lib/cookSession/misEnPlace.js";
import type { Recipe, UtensilDbItem } from "@/lib/types.js";

interface PublicRecipeScreenProps {
  /** `undefined` pendant le chargement, `null` si introuvable. */
  docs: { pub: PublicDoc; components: Recipe[] } | null | undefined;
  /** Classe d'entrée de la fiche (vide au retour arrière, cf. App). */
  enterClass: string;
  isDesktop: boolean;
  user: User;
  isAdmin: boolean;
  /** La recette publique figure déjà dans la bibliothèque (clone ou propre recette). */
  owned: boolean;
  onClone: (pub: PublicDoc) => void;
  onExportPDF: (recipe: Recipe) => void;
  notify: (message: string, type?: string) => void;
  ingredientDB: DbEntry[];
  utensilDB: UtensilDbItem[];
  categories: CategoryMap;
}

/** Fiche d'une recette publique de la communauté (`/discover/:pubId`), en lecture seule. */
export function PublicRecipeScreen({ docs, enterClass, isDesktop, user, isAdmin, owned, onClone, onExportPDF, notify, ingredientDB, utensilDB, categories }: PublicRecipeScreenProps) {
  const navigate = useNavigate();
  const back = () => navigate("/discover");
  if (docs === undefined) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 26, height: 26, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
      </div>
    );
  }
  if (!docs) return <RecipeNotFound onBack={back} />;
  const { pub } = docs;
  return (
    <div key={pub.pubId} className={`${enterClass}${isDesktop ? " desktop-content" : ""}`} style={{ flex: 1, overflow: isDesktop ? "hidden" : "auto", minHeight: 0 }}>
      <RecipeDetail
        recipe={pub.recipe}
        recipes={docs.components}
        publicMode
        owned={owned}
        authorName={pub.authorName}
        authorPhoto={pub.authorPhoto}
        authorUid={pub.authorUid}
        onClone={() => onClone(pub)}
        onBack={back}
        onExportPDF={onExportPDF}
        isAdmin={isAdmin}
        onReport={(reason, note) => reportPublicRecipe({ pubId: pub.pubId, recipeName: pub.recipe.name, authorUid: pub.authorUid, reason: reason || "", note, reporterUid: user.uid, reporterEmail: user.email || null })
          .then(() => notify("Merci, ton signalement a été transmis."))
          .catch(() => notify("Signalement impossible pour le moment.", "error"))}
        onAdminDelete={() => deletePublicRecipe(pub.pubId)
          .then(() => { notify("Recette retirée de la communauté."); back(); })
          .catch(() => notify("Suppression impossible.", "error"))}
        ingredientDB={ingredientDB} utensilDB={utensilDB} categories={categories} collections={[]} notify={notify}
      />
    </div>
  );
}
