import { Icon } from "./Icon.jsx";
import { Img, IngImage } from "./Img.jsx";
import { RecipePlaceholder } from "./RecipePlaceholder.jsx";
import { NutriScoreBadge } from "./NutriScoreBadge.jsx";
import { ingredientMonths, currentMonth } from "../lib/seasonality.js";
import { fmtTime } from "../lib/format.js";

// ─── L'INGRÉDIENT DU MOMENT ───────────────────────────────────────────────────
// Carte éditoriale en tête de « Découvrir » : un fruit/légume de saison, sa frise
// de saison (donnée réelle `months`), une accroche (description), et les recettes
// publiques qui l'utilisent — ou une invitation à publier si la communauté est vide.
const MONTHS_INI = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const CAT_LABEL = { fruit: "Fruit", vegetable: "Légume" };

function SeasonFrieze({ months }) {
  const on = new Set(months || []);
  const now = currentMonth();
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10.5, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text3)", fontWeight: 600, margin: "0 2px 6px" }}>Sa saison</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 6 }}>
        {MONTHS_INI.map((m, i) => {
          const month = i + 1, active = on.has(month), isNow = month === now;
          return (
            <div key={i} title={isNow ? "Ce mois-ci" : undefined} style={{
              height: 24, borderRadius: 7, display: "grid", placeItems: "center",
              fontSize: 10, fontWeight: 700,
              background: active ? "var(--accent)" : "var(--surface2)",
              color: active ? "#fff" : "var(--text3)",
              boxShadow: active ? "0 3px 8px -3px rgba(232,112,58,0.7)" : "none",
              outline: isNow ? "2px solid var(--accent-deep, #cf5320)" : "none", outlineOffset: 1,
            }}>{m}</div>
          );
        })}
      </div>
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

export function SpotlightIngredient({ ingredient, recipes = [], onOpenIngredient, onOpenPublic, onPublish }) {
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
        <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 16, fontWeight: 600, margin: 0 }}>L'ingrédient du moment</h3>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>chaque semaine</span>
      </div>

      <article style={{ position: "relative", overflow: "hidden", borderRadius: 20, border: "1px solid rgba(232,112,58,0.16)", background: "linear-gradient(158deg, color-mix(in srgb, var(--accent) 7%, var(--surface)), var(--surface) 62%)", padding: "16px 16px 14px", boxShadow: "0 10px 26px -14px rgba(120,70,30,0.28)" }}>
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
            <div className="discover-row" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, margin: "0 -2px", scrollSnapType: "x proximity" }}>
              {recipes.map(p => <MiniRecipe key={p.pubId} pub={p} onOpen={onOpenPublic} />)}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(232,112,58,0.06)", border: "1px dashed rgba(232,112,58,0.35)", borderRadius: 14, padding: "12px 13px" }}>
            <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, background: "rgba(232,112,58,0.15)", color: "var(--accent)", display: "grid", placeItems: "center" }}>
              <Icon name="plus" size={18} color="var(--accent)" />
            </span>
            <span style={{ fontSize: 12.5, lineHeight: 1.4, color: "var(--text2)" }}>
              Personne n'a encore partagé de recette {catLabel === "Fruit" ? "à la" : "au"} {ingredient.name.toLowerCase()}. <strong style={{ color: "var(--text)" }}>Ouvre le bal ?</strong>
            </span>
            <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto", flexShrink: 0 }} onClick={onPublish}>Publier</button>
          </div>
        )}
      </article>
    </section>
  );
}
