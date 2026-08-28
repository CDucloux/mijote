import { Icon } from "../Icon.jsx";
import { Img } from "../Img.jsx";
import { RecipePlaceholder } from "../RecipePlaceholder.jsx";
import { HeroMenu } from "../HeroMenu.jsx";
import { RecipeHeroBadges } from "./RecipeHeroBadges.jsx";
import { HERO_H } from "../../hooks/useHeroCollapse.js";

/**
 * Hero mobile plein cadre, replié au défilement par `useHeroCollapse` : image parallaxe,
 * voile, boutons overlay, titre/source/attribution et badges. Les refs d'animation sont
 * fournies par le hook parent et attachées ici ; le hook écrit directement dans le DOM.
 */
export function RecipeHeroMobile({
  recipe, handleBack, publicMode, onEdit, onExportPDF, reportAvailable, adminDeleteAvailable, onOpenReport, onOpenAdminDelete, menuItems, attribution, badges,
  heroImgRef, shadeRef, ctrlLRef, ctrlRRef, titleRef, srcRef, attribRef, badgesRef,
}) {
  return (
    <div style={{ position: "relative", height: `calc(${HERO_H}px + var(--safe-hero-top))`, flexShrink: 0, color: "#fff", overflow: "hidden" }}>
      {/* Couche de parallaxe : transformée par le hook. transformOrigin en haut pour que
          la montée en échelle se propage vers le bas et ne laisse jamais de bande vide. */}
      <div ref={heroImgRef} style={{ position: "absolute", inset: 0, transformOrigin: "50% 0%", willChange: "transform" }}>
        <Img src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} fallback={<RecipePlaceholder name={recipe.name} fontSize={104} style={{ width: "100%", height: "100%" }} />} />
      </div>
      <div ref={shadeRef} style={{ position: "absolute", inset: 0, willChange: "opacity", background: "linear-gradient(to bottom,rgba(0,0,0,0.34) 0%,transparent 38%,rgba(0,0,0,0.74) 100%)" }} />
      {/* Boutons overlay */}
      <div ref={ctrlLRef} style={{ position: "absolute", top: "calc(16px + var(--safe-hero-top))", left: 16 }}>
        <button onClick={handleBack} className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="back" size={18} color="#fff" /></button>
      </div>
      {publicMode && (onExportPDF || reportAvailable || adminDeleteAvailable) && (
      <div ref={ctrlRRef} style={{ position: "absolute", top: "calc(16px + var(--safe-hero-top))", right: 16, display: "flex", gap: 8 }}>
        {onExportPDF && (
          <button onClick={() => onExportPDF(recipe)} title="Exporter en PDF" className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="pdf" size={16} color="#fff" /></button>
        )}
        {reportAvailable && (
          <button onClick={onOpenReport} title="Signaler" className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="flag" size={16} color="#fff" /></button>
        )}
        {adminDeleteAvailable && (
          <button onClick={onOpenAdminDelete} title="Supprimer (admin)" className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="trash" size={16} color="#ff6b6b" /></button>
        )}
      </div>
      )}
      {!publicMode && (
      <div ref={ctrlRRef} style={{ position: "absolute", top: "calc(16px + var(--safe-hero-top))", right: 16, display: "flex", gap: 8 }}>
        <button onClick={onEdit} className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="edit" size={16} color="#fff" /></button>
        <button onClick={() => onExportPDF(recipe)} className="ripple ripple-light" style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}><Icon name="pdf" size={16} color="#fff" /></button>
        <HeroMenu
          className="ripple ripple-light"
          btnStyle={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}
          items={menuItems} />
      </div>
      )}
      {/* Titre + source + tags, départ étagé piloté par le hook (refs). */}
      <div style={{ position: "absolute", bottom: 16, left: 18, right: 18 }}>
        <h1 ref={titleRef} style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 4, color: "#fff", transformOrigin: "left bottom", willChange: "transform, opacity" }}>{recipe.name}</h1>
        {attribution && <div ref={attribRef} style={{ willChange: "transform, opacity" }}>{attribution}</div>}
        {!publicMode && recipe.source && (
          <a ref={srcRef} href={recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.65)", textDecoration: "none", marginBottom: 6, willChange: "transform, opacity" }}>
            {(() => { try { return new URL(recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source).hostname.replace(/^www\./, ""); } catch { return recipe.source.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0]; } })()}
            <Icon name="externalLink" size={10} color="rgba(255,255,255,0.65)" />
          </a>
        )}
        <div ref={badgesRef} style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", willChange: "transform, opacity" }}>
          <RecipeHeroBadges recipe={recipe} {...badges} variant="mobile" />
        </div>
      </div>
    </div>
  );
}
