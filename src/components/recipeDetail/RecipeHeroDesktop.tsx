import type { ReactNode } from "react";
import type { Recipe } from "@/lib/types.js";
import { Icon } from "../ui/Icon.jsx";
import { Img } from "../ui/Img.jsx";
import { RecipePlaceholder } from "../recipe/RecipePlaceholder.jsx";
import { HeroMenu } from "./HeroMenu.jsx";
import { SourceLink } from "./SourceLink.jsx";
import type { MenuItem } from "./HeroMenu.jsx";
import { RecipeHeroBadges } from "./RecipeHeroBadges.jsx";
import type { HeroBadgesProps } from "./RecipeHeroBadges.jsx";

interface RecipeHeroDesktopProps {
  recipe: Recipe;
  handleBack: () => void;
  publicMode?: boolean;
  onEdit: () => void;
  onExportPDF: (recipe: Recipe) => void;
  reportAvailable?: boolean;
  adminDeleteAvailable?: boolean;
  onOpenReport: () => void;
  onOpenAdminDelete: () => void;
  menuItems: MenuItem[];
  attribution?: ReactNode;
  badges: HeroBadgesProps;
}

/**
 * Hero compact de la fiche en desktop : image, dégradé, boutons d'action (édition/PDF/
 * menu, ou actions de modération en mode public), titre, attribution et rangée de badges.
 * Purement présentationnel ; toutes les actions sont fournies par le parent.
 */
export function RecipeHeroDesktop({ recipe, handleBack, publicMode, onEdit, onExportPDF, reportAvailable, adminDeleteAvailable, onOpenReport, onOpenAdminDelete, menuItems, attribution, badges }: RecipeHeroDesktopProps) {
  return (
    <div style={{ position: "relative", height: 160, flexShrink: 0, color: "#fff" }}>
      <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%" }} fallback={<RecipePlaceholder name={recipe.name} fontSize={72} style={{ width: "100%", height: "100%" }} />} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.2) 0%,transparent 35%,rgba(14,14,15,0.82) 100%)" }} />
      <button onClick={handleBack} className="hero-back ripple ripple-light" style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={18} /></button>
      {publicMode && (onExportPDF || reportAvailable || adminDeleteAvailable) && (
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
        {onExportPDF && (
          <button onClick={() => onExportPDF(recipe)} title="Exporter en PDF" className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="pdf" size={16} /></button>
        )}
        {reportAvailable && (
          <button onClick={onOpenReport} title="Signaler" className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="flag" size={16} color="#fff" /></button>
        )}
        {adminDeleteAvailable && (
          <button onClick={onOpenAdminDelete} title="Supprimer (admin)" className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="trash" size={16} color="#ff6b6b" /></button>
        )}
      </div>
      )}
      {!publicMode && (
      <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8 }}>
        <button onClick={onEdit} className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={16} /></button>
        <button onClick={() => onExportPDF(recipe)} className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="pdf" size={16} /></button>
        <HeroMenu
          className="ripple ripple-light"
          btnStyle={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
          items={menuItems} />
      </div>
      )}
      <div style={{ position: "absolute", bottom: 14, left: 20, right: 20 }}>
        <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 2 }}>{recipe.name}</h1>
        {attribution}
        {!publicMode && recipe.source && (
          <SourceLink source={recipe.source} iconSize={11} style={{ marginTop: 1, marginBottom: 8 }} />
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <RecipeHeroBadges recipe={recipe} {...badges} variant="desktop" />
        </div>
      </div>
    </div>
  );
}
