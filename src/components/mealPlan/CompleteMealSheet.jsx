import { useState, useMemo } from "react";
import { Icon } from "../ui/Icon.jsx";
import { Img } from "../ui/Img.jsx";
import { SearchField } from "../ui/SearchField.jsx";
import { NutriScoreBadge } from "../badges/NutriScoreBadge.jsx";
import { EmptyArt } from "../ui/EmptyArt.jsx";
import { ElasticScroll } from "../ui/ElasticScroll.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { roleForCategory, roleLabel } from "@/lib/planning/composedMeal.js";
import { normalizeStr } from "@/lib/food/parseIngredient.js";
import { suggestSides } from "@/lib/planning/mealPlanner.js";
import { fmtTime } from "@/lib/format.js";

// Rôles proposés pour compléter un repas (le plat existe déjà).
const COMPLETE_ROLES = [
  { id: "entree", label: "Entrée" },
  { id: "accompagnement", label: "Accompagnement" },
  { id: "dessert", label: "Dessert" },
];

/**
 * Feuille « Compléter le repas » : autour d'un plat de base, suggère des recettes de
 * saison (ou filtre la bibliothèque éligible) pour un rôle donné (entrée /
 * accompagnement / dessert). Rôle et recherche sont un état LOCAL. L'ajout est délégué
 * au parent via onAttach(recipeId, role).
 */
export function CompleteMealSheet({ base, eligiblePool, suggestCtx, liveNutri, onAttach, onClose }) {
  const [completeRole, setCompleteRole] = useState("accompagnement");
  const [completeSearch, setCompleteSearch] = useState("");
  const q = normalizeStr(completeSearch.trim());
  const list = useMemo(
    () => q
      ? eligiblePool.filter(r => roleForCategory(r.category || "") === completeRole && normalizeStr(r.name).includes(q)).slice(0, 20)
      : suggestSides(base, eligiblePool, suggestCtx, { role: completeRole, max: 12 }),
    [q, eligiblePool, completeRole, base, suggestCtx],
  );

  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "86dvh" }}>
      {/* En-tête : vignette du plat de base + titre contextuel */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, overflow: "hidden", flexShrink: 0, background: "var(--surface2)", display: "grid", placeItems: "center" }}>
          {base?.image ? <Img src={base.image} alt={base.name} style={{ width: "100%", height: "100%" }} /> : <Icon name="plus" size={20} color="var(--accent)" />}
        </div>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", margin: 0 }}>Compléter le repas</h3>
          {base && <div style={{ fontSize: 12.5, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Autour de <strong style={{ color: "var(--text2)" }}>{base.name}</strong></div>}
        </div>
      </div>

      {/* Contrôle segmenté (rôle) : pastille active blanche qui GLISSE d'un
          onglet à l'autre (translateX), comme les autres sélecteurs de l'app. */}
      <div style={{ position: "relative", display: "flex", padding: 4, background: "var(--surface2)", borderRadius: 14, marginBottom: 14 }}>
        <div aria-hidden="true" style={{
          position: "absolute", top: 4, bottom: 4, left: 4, width: `calc((100% - 8px) / ${COMPLETE_ROLES.length})`,
          background: "var(--surface)", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
          transform: `translateX(calc(${Math.max(0, COMPLETE_ROLES.findIndex(x => x.id === completeRole))} * 100%))`,
          transition: "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
        }} />
        {COMPLETE_ROLES.map(r => {
          const active = completeRole === r.id;
          return (
            <button key={r.id} onClick={() => setCompleteRole(r.id)}
              style={{ position: "relative", zIndex: 1, flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "none",
                background: "transparent", color: active ? "var(--accent)" : "var(--text3)",
                transition: "color 0.3s ease" }}>
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Recherche standard (loupe clavier mobile, effacement) */}
      <SearchField value={completeSearch} onChange={setCompleteSearch} placeholder={`Rechercher ${roleLabel(completeRole).toLowerCase()}…`} style={{ marginBottom: 16 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <Icon name={q ? "search" : "sun"} size={13} color="var(--accent)" />
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{q ? "Résultats" : "Suggestions de saison"}</span>
        {list.length > 0 && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>{list.length}</span>}
      </div>

      <ElasticScroll max={64} style={{ maxHeight: "46vh", margin: "0 -2px", padding: "2px 2px 4px" }} contentStyle={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {list.map(r => {
          const total = (r.prepTime || 0) + (r.cookTime || 0);
          const nIng = r.ingredients?.length || 0;
          const nutri = liveNutri(r);
          return (
            <button key={r.id} onClick={() => onAttach(r.id, completeRole)} className="complete-row ripple"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", textAlign: "left", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
              <div style={{ width: 54, height: 54, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><Img src={r.image} alt={r.name} style={{ width: "100%", height: "100%" }} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>{r.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {r.cuisine && <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text2)", background: "var(--surface2)", borderRadius: 6, padding: "2px 7px" }}>{r.cuisine}</span>}
                  {total > 0 && <span style={{ fontSize: 11, color: "var(--text3)", display: "inline-flex", alignItems: "center", gap: 3 }}><Icon name="clock" size={11} color="var(--text3)" /> {fmtTime(total)}</span>}
                  {nIng > 0 && <span style={{ fontSize: 11, color: "var(--text3)" }}>{nIng} ingr.</span>}
                  {nutri && <NutriScoreBadge letter={nutri} compact />}
                </div>
              </div>
              <span className="complete-add" style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.12)", color: "var(--accent)" }}>
                <Icon name="plus" size={17} color="currentColor" />
              </span>
            </button>
          );
        })}
        {list.length === 0 && (
          <div style={{ textAlign: "center", padding: "28px 20px", color: "var(--text3)" }}>
            <EmptyArt name="loupe" size={78} style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>Aucune recette « {roleLabel(completeRole).toLowerCase()} » {q ? "ne correspond à ta recherche" : "disponible pour l'instant"}.</p>
          </div>
        )}
      </ElasticScroll>
    </SwipeableSheet>
  );
}
