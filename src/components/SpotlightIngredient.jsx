import { Icon } from "./Icon.jsx";
import { Img, IngImage } from "./Img.jsx";
import { RecipePlaceholder } from "./RecipePlaceholder.jsx";
import { NutriScoreBadge } from "./NutriScoreBadge.jsx";
import { ingredientMonths } from "@/lib/food/seasonality.js";
import { fmtTime } from "../lib/format.js";
import { OverscrollRow } from "./OverscrollRow.jsx";
import { SeasonBar } from "./SeasonBar.jsx";

// ─── L'INGRÉDIENT DU MOMENT ───────────────────────────────────────────────────
// Carte éditoriale en tête de « Découvrir » : un fruit/légume de saison, sa frise
// de saison (donnée réelle `months`), une accroche (description), et les recettes
// publiques qui l'utilisent — ou une invitation à publier si la communauté est vide.
const CAT_LABEL = { fruit: "Fruit", vegetable: "Légume" };

// Frise de saison (accent) : réutilise la barre partagée <SeasonBar/> et ajoute
// l'en-tête « Sa saison · N mois ».
function SeasonFrieze({ months }) {
  const count = new Set(months || []).size;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "0 2px 9px" }}>
        <span style={{ fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text3)", fontWeight: 600 }}>Sa saison</span>
        <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500 }}>{count} mois / an</span>
      </div>
      <SeasonBar months={months} />
    </div>
  );
}

function MiniRecipe({ pub, onOpen }) {
  const r = pub.recipe;
  return (
    <button onClick={() => onOpen?.(pub)} className="pressable" style={{ flex: "0 0 132px", scrollSnapAlign: "start", background: "var(--surface)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", boxShadow: "0 4px 12px -8px rgba(80,50,20,0.3)", textAlign: "left", cursor: "pointer", padding: 0 }}>
      <div style={{ height: 76, position: "relative" }}>
        <Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} fallback={<RecipePlaceholder name={r.name} fontSize={30} style={{ width: "100%", height: "100%" }} />} />
      </div>
      <div style={{ padding: "8px 9px 9px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 30 }}>{r.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 10.5, color: "var(--text3)", fontWeight: 500 }}>
          <Icon name="clock" size={11} color="var(--text3)" /> {fmtTime((r.prepTime || 0) + (r.cookTime || 0))}
          <span style={{ marginLeft: "auto" }}><NutriScoreBadge letter={r.nutriLetter} compact /></span>
        </div>
      </div>
    </button>
  );
}

export function SpotlightIngredient({ ingredient, recipes = [], loading = false, onOpenIngredient, onOpenPublic, onPublish }) {
  if (!ingredient) return null;
  const months = ingredientMonths(ingredient);
  const catLabel = CAT_LABEL[ingredient.category] || "Ingrédient";
  const hasRecipes = recipes.length > 0;

  return (
    <section style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 2px 12px" }}>
        {/* Pousse / jeune plant : distinct de l'étoile de « Découvrir », évoque le produit frais */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20v-7" />
          <path d="M12 13C12 9.7 9.5 8 6 8c0 3.5 2.5 5 6 5Z" />
          <path d="M12 11c0-3 2.5-4.6 6-4.6 0 3.4-2.5 4.6-6 4.6Z" />
        </svg>
        <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>L'ingrédient du moment</h3>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>chaque semaine</span>
      </div>

      <article style={{ position: "relative", overflow: "hidden", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", padding: "16px 16px 14px", boxShadow: "0 10px 26px -16px rgba(120,70,30,0.22)" }}>
        <span aria-hidden="true" style={{ position: "absolute", insetInline: 0, top: 0, height: 3, background: "linear-gradient(90deg, var(--accent), #f4a05f)" }} />

        {/* En-tête cliquable → fiche ingrédient */}
        <button onClick={() => onOpenIngredient?.(ingredient)} style={{ display: "flex", gap: 14, alignItems: "center", width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ flexShrink: 0, width: 74, height: 74, borderRadius: "50%", overflow: "hidden", background: "radial-gradient(circle at 34% 30%, #fff, var(--surface2))", boxShadow: "0 6px 16px -8px rgba(110,61,109,0.45), 0 0 0 1px var(--border)", display: "grid", placeItems: "center" }}>
            <IngImage src={ingredient.image} alt={ingredient.name} size={74} />
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 6, color: "var(--text)" }}>{ingredient.name}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(232,146,10,0.95)", color: "#fff", fontWeight: 700, fontSize: 10, padding: "3px 9px 3px 7px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                <Icon name="sun" size={11} color="#fff" /> De saison
              </span>
              <span style={{ fontSize: 12, color: "var(--text3)", fontWeight: 500 }}>{catLabel}</span>
            </span>
          </span>
          <Icon name="forward" size={16} color="var(--text3)" />
        </button>

        {ingredient.description && (
          <p style={{ margin: "13px 2px 2px", fontSize: 13.5, lineHeight: 1.5, color: "var(--text2)" }}>{ingredient.description}</p>
        )}

        {months && <SeasonFrieze months={months} />}

        <div style={{ height: 1, background: "var(--border)", margin: "14px 0 12px" }} />

        {hasRecipes ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 2px 10px" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text2)" }}>À cuisiner · {recipes.length} recette{recipes.length > 1 ? "s" : ""} de la communauté</span>
            </div>
            <OverscrollRow stretch className="discover-row" style={{ gap: 10, paddingBottom: 4 }} outerStyle={{ margin: "0 -2px", scrollSnapType: "x proximity" }}>
              {recipes.map(p => <MiniRecipe key={p.pubId} pub={p} onOpen={onOpenPublic} />)}
            </OverscrollRow>
          </>
        ) : loading ? (
          // Chargement initial des recettes communautaires : squelette discret, pour
          // ne pas faire clignoter l'état « personne n'a publié » avant l'arrivée des données.
          <div style={{ display: "flex", gap: 10 }}>
            {[0, 1].map(i => (
              <div key={i} className="skeleton" style={{ width: 132, height: 150, borderRadius: 14, flexShrink: 0 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(232,112,58,0.06)", border: "1px dashed rgba(232,112,58,0.35)", borderRadius: 14, padding: "12px 13px" }}>
            <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: "rgba(232,112,58,0.15)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
              <Icon name="plus" size={18} color="var(--accent)" />
            </span>
            <span style={{ fontSize: 12.5, lineHeight: 1.4, color: "var(--text2)" }}>
              Personne n'a encore partagé de recette contenant cet ingrédient. <strong style={{ color: "var(--text)" }}>Et si tu ouvrais le bal ?</strong>
            </span>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto", flexShrink: 0 }} onClick={onPublish}>Publier</button>
          </div>
        )}
      </article>
    </section>
  );
}
