import { Icon } from "../Icon.jsx";
import { OfficialAvatar } from "../OfficialAvatar.jsx";
import { isOfficialAuthor } from "@/lib/household/publicRecipes.js";

/**
 * Attribution affichée dans le hero d'une recette publique : pastille « Créé par :
 * {auteur} » (ou « Par » + avatar officiel pour un compte Cardamome), suivie hors
 * pastille du lien « d'après {source} » vers la source web d'origine.
 */
export function RecipeAttribution({ recipe, authorUid, authorName, authorPhoto }) {
  const sourceHref = recipe.source ? (recipe.source.startsWith("http") ? recipe.source : "https://" + recipe.source) : null;
  const sourceHost = recipe.source ? (() => { try { return new URL(sourceHref).hostname.replace(/^www\./, ""); } catch { return recipe.source.replace(/^https?:\/\/(?:www\.)?/, "").split("/")[0]; } })() : "";
  const official = isOfficialAuthor(authorUid);
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
      {recipe.source && (
        <a href={sourceHref} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(255,255,255,0.7)", textDecoration: "none" }}>
          d'après {sourceHost}
          <Icon name="externalLink" size={10} color="rgba(255,255,255,0.7)" />
        </a>
      )}
    </div>
  );
}
