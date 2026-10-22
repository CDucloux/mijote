import { useState, useMemo } from "react";
import { Icon, type IconName } from "../ui/Icon.jsx";
import { RecipeImage } from "../recipe/RecipePlaceholder.jsx";
import { SearchField } from "../ui/SearchField.jsx";
import { NutriScoreBadge } from "../badges/NutriScoreBadge.jsx";
import { EmptyArt } from "../ui/EmptyArt.jsx";
import { ElasticScroll } from "../ui/ElasticScroll.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { roleLabel, type RoleId } from "@/lib/planning/composedMeal.js";
import { completeMealSections } from "@/lib/planning/completeMeal.js";
import type { PlannerContext } from "@/lib/planning/mealPlanner.js";
import { fmtTime } from "@/lib/format.js";
import type { Recipe } from "@/lib/types.js";
import type { NutriLetter } from "../badges/NutriScoreBadge.jsx";

// Rôles proposés pour compléter un repas (le plat existe déjà).
const COMPLETE_ROLES: { id: RoleId; label: string }[] = [
  { id: "entree", label: "Entrée" },
  { id: "accompagnement", label: "Accompagnement" },
  { id: "dessert", label: "Dessert" },
];

/** En-tête de section de la liste (icône accent, libellé, compteur à droite). */
function SectionLabel({ icon, label, count, spaced }: { icon: IconName; label: string; count: number; spaced?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 10px", margin: `${spaced ? 18 : 0}px 0 6px` }}>
      <Icon name={icon} size={13} color="var(--accent)" />
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--text3)" }}>{count}</span>
    </div>
  );
}

/** Props de la feuille « Compléter le repas ». */
interface CompleteMealSheetProps {
  base: Recipe | null;
  /** Toute la bibliothèque, listée sous les suggestions. */
  recipes: Recipe[];
  eligiblePool: Recipe[];
  suggestCtx: PlannerContext;
  liveNutri: (recipe: Recipe) => NutriLetter | null | undefined;
  onAttach: (recipeId: string, role: RoleId) => void;
  onClose: () => void;
}

/**
 * Feuille « Compléter le repas » : autour d'un plat de base, suggère des recettes de
 * saison pour un rôle donné (entrée / accompagnement / dessert), puis liste toute la
 * bibliothèque (rôle demandé en tête) ; la recherche porte sur la bibliothèque entière. Rôle et recherche sont un état LOCAL. L'ajout est délégué
 * au parent via onAttach(recipeId, role).
 */
export function CompleteMealSheet({ base, recipes, eligiblePool, suggestCtx, liveNutri, onAttach, onClose }: CompleteMealSheetProps) {
  const [completeRole, setCompleteRole] = useState<RoleId>("accompagnement");
  const [completeSearch, setCompleteSearch] = useState("");
  const q = completeSearch.trim();
  const { suggestions, library } = useMemo(
    () => completeMealSections(base, recipes, eligiblePool, suggestCtx, completeRole, completeSearch),
    [base, recipes, eligiblePool, suggestCtx, completeRole, completeSearch],
  );

  const renderRow = (r: Recipe) => {
    const total = (r.prepTime || 0) + (r.cookTime || 0);
    const nIng = r.ingredients?.length || 0;
    const nutri = liveNutri(r);
    return (
      <button key={r.id} onClick={() => onAttach(r.id ?? "", completeRole)} className="complete-row ripple"
        style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "transparent", borderRadius: 16, border: "none", textAlign: "left", cursor: "pointer" }}>
        <div style={{ width: 54, height: 54, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}><RecipeImage recipe={r} fontSize={24} /></div>
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
  };

  return (
    <SwipeableSheet onClose={onClose} style={{ maxHeight: "86dvh" }}>
      {/* En-tête : vignette du plat de base + titre contextuel */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, overflow: "hidden", flexShrink: 0, background: "var(--surface2)", display: "grid", placeItems: "center" }}>
          {base?.image ? <RecipeImage recipe={base} fontSize={24} /> : <Icon name="plus" size={20} color="var(--accent)" />}
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
            <button key={r.id} onClick={() => setCompleteRole(r.id)} className={`seg-opt${active ? " on" : ""}`}
              style={{ position: "relative", zIndex: 1, flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "none",
                background: "transparent", color: active ? "var(--accent)" : undefined }}>
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Recherche standard (loupe clavier mobile, effacement) */}
      <SearchField value={completeSearch} onChange={setCompleteSearch} placeholder={`Rechercher ${roleLabel(completeRole).toLowerCase()}…`} style={{ marginBottom: 16 }} />

      {/* Hauteur fixe (et non max) : la feuille garde sa taille quand la recherche filtre. */}
      <ElasticScroll max={64} style={{ height: "46vh", margin: "0 -10px", padding: "0 0 4px" }} contentStyle={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {suggestions.length > 0 && <SectionLabel icon="sun" label="Suggestions de saison" count={suggestions.length} />}
        {suggestions.map(renderRow)}
        {library.length > 0 && <SectionLabel icon={q ? "search" : "book"} label={q ? "Résultats" : "Ta bibliothèque"} count={library.length} spaced={suggestions.length > 0} />}
        {library.map(renderRow)}
        {suggestions.length + library.length === 0 && (
          <div style={{ textAlign: "center", padding: "28px 20px", color: "var(--text3)" }}>
            <EmptyArt name="loupe" size={78} style={{ margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13.5, lineHeight: 1.5, margin: 0 }}>Aucune recette {q ? "ne correspond à ta recherche" : "dans ta bibliothèque"}.</p>
          </div>
        )}
      </ElasticScroll>
    </SwipeableSheet>
  );
}
