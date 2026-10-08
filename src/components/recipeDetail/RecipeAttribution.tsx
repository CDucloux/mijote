import type { Recipe } from "@/lib/types.js";
import { RecipeCredits } from "./RecipeCredits.jsx";
import { OfficialAvatar } from "../user/OfficialAvatar.jsx";
import { isOfficialAuthor } from "@/lib/household/publicRecipes.js";

interface RecipeAttributionProps {
  recipe: Recipe;
  authorUid?: string;
  authorName?: string;
  authorPhoto?: string;
}

/**
 * Attribution affichée dans le hero d'une recette publique : pastille « Créé par :
 * {auteur} » (ou « Par » + avatar officiel pour un compte Cardamome), suivie hors
 * pastille du chef et du lien « d'après {source} » vers la source web d'origine.
 */
export function RecipeAttribution({ recipe, authorUid, authorName, authorPhoto }: RecipeAttributionProps) {
  const official = isOfficialAuthor(authorUid ?? "");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 11px 3px 4px", borderRadius: 20, background: "rgba(20,18,16,0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.22)" }}>
        {official
          ? <OfficialAvatar size={18} ring />
          : authorPhoto
            ? <img src={authorPhoto} alt="" referrerPolicy="no-referrer" style={{ width: 18, height: 18, borderRadius: "50%" }} />
            : <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.25)" }} />}
        <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{official ? "Par" : "Créé par :"} {authorName || "un mijoteur"}</span>
      </span>
      <RecipeCredits recipe={recipe} sourcePrefix="d'après" />
    </div>
  );
}
