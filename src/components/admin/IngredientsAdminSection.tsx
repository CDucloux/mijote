import { Icon } from "../ui/Icon.jsx";
import { useLS } from "../../hooks/useLS.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { IngImage } from "../ui/Img.jsx";
import { SearchField } from "../ui/SearchField.jsx";
import { IngredientStatusBadge } from "../badges/IngredientStatusBadge.jsx";
import { UnderlineTabs } from "../ui/UnderlineTabs.jsx";
import { MasterBadge } from "./AdminPrimitives.jsx";
import { BaseMenu } from "./BaseMenu.jsx";
import { IngredientCategoryNav } from "./IngredientCategoryNav.jsx";
import { countTrackingFilters, matchesTrackingFilter } from "@/lib/food/ingredientTracking.js";
import type { IngredientTrackingFilter } from "@/lib/food/ingredientTracking.js";
import { countByCategory, groupAdminIngredients } from "@/lib/food/ingredientAdminView.js";
import { sortedCategoryEntries } from "@/constants/categories.js";
import type { IngredientDbItem } from "@/lib/types.js";
import type { IngredientCategory } from "@/lib/data/referenceData.js";
import type { BaseTransfer } from "../../hooks/useMasterImports.js";

// Ce qu'il reste à rédiger sur une fiche, en sous-titre de sa ligne.
function rowHint(item: IngredientDbItem): { text: string; done: boolean } {
  const gaps = [matchesTrackingFilter(item, "no-image") && "photo", matchesTrackingFilter(item, "no-nutrition") && "nutrition"].filter(Boolean);
  if (item.status === "validated") return { text: "Validé", done: true };
  return { text: gaps.length ? `Sans ${gaps.join(" ni ")}` : "En cours de rédaction", done: false };
}

function IngredientRow({ item, onOpen }: { item: IngredientDbItem; onOpen: () => void }) {
  const hint = rowHint(item);
  return (
    <button onClick={onOpen} title="Ouvrir la fiche" className="ripple hover-neutral dash-card" style={{
      width: "100%", minWidth: 0, display: "flex", alignItems: "center", gap: 12, padding: "9px 12px 9px 10px",
      borderRadius: 14, border: "none", background: "transparent", textAlign: "left", cursor: "pointer",
    }}>
      <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
        <IngImage src={item.image} alt={item.name} size={42} />
        <IngredientStatusBadge status={item.status} size={16} ring="var(--float-surface)" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name || "Sans nom"}</span>
        <span style={{ display: "block", fontSize: 12, color: hint.done ? "var(--ok)" : "var(--text3)", marginTop: 2 }}>{hint.text}</span>
      </span>
      {item._ro === true && <MasterBadge />}
      <span className="dash-chevron"><Icon name="forward" size={14} color="currentColor" /></span>
    </button>
  );
}

interface IngredientsAdminSectionProps {
  ingredientDB: IngredientDbItem[];
  categories: Record<string, IngredientCategory>;
  isAdmin: boolean;
  filter: IngredientTrackingFilter | null;
  onFilter: (filter: IngredientTrackingFilter | null) => void;
  /** Catégorie affichée, `null` pour toutes. */
  category: string | null;
  onCategory: (category: string | null) => void;
  search: string;
  onSearch: (search: string) => void;
  onReorder: (fromKey: string, toKey: string) => void;
  onCreate: (categoryKey: string) => void;
  onOpen: (id: string) => void;
  transfer: BaseTransfer;
}

/**
 * Section « Ingrédients » : au large, deux volets (recherche et catégories à
 * gauche ; fiches de la sélection et menu « Base » à droite), une colonne en
 * mobile. Filtre de suivi éditorial piloté aussi par le tableau de bord.
 */
export function IngredientsAdminSection({ ingredientDB, categories, isAdmin, filter, onFilter, category, onCategory, search, onSearch, onReorder, onCreate, onOpen, transfer }: IngredientsAdminSectionProps) {
  const counts = countTrackingFilters(ingredientDB);
  const filters: [IngredientTrackingFilter | null, string, number][] = [[null, "Tous", counts.all], ["draft", "En cours", counts.draft], ["validated", "Validés", counts.validated], ["no-image", "Sans photo", counts["no-image"]], ["no-nutrition", "Sans nutrition", counts["no-nutrition"]]];
  const order = sortedCategoryEntries(categories).map(([key]) => key);
  const groups = groupAdminIngredients(ingredientDB, order, { category, filter, search });
  const shown = groups.reduce((n, g) => n + g.items.length, 0);
  const selected = category !== null ? categories[category] : undefined;
  // Volet gauche repliable au large seulement (en mobile, les catégories sont une rangée de pastilles).
  const [asideOpen, setAsideOpen] = useLS("rf_adminIngAsideOpen", true);
  const canFold = useMediaQuery("(min-width: 900px)"); // même seuil que `.ing-admin` (global.css)

  return (
    <div className="slide-up ing-admin" data-folded={(canFold && !asideOpen) || undefined}>
      <aside className="ing-admin-aside" inert={canFold && !asideOpen}>
        <SearchField value={search} onChange={onSearch} placeholder="Rechercher un ingrédient" />
        <IngredientCategoryNav categories={categories} counts={countByCategory(ingredientDB, filter)} total={filter ? counts[filter] : counts.all}
          value={category} onChange={onCategory} onReorder={isAdmin ? onReorder : undefined} />
      </aside>

      <section style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: 12 }}>
            {canFold && (
              <button className="icon-btn-soft ripple ing-admin-fold" onClick={() => setAsideOpen(o => !o)}
                aria-expanded={asideOpen} title={asideOpen ? "Masquer les catégories" : "Afficher les catégories"}>
                <Icon name="sidebar" size={18} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
            <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              {selected && <span style={{ fontSize: 24 }}>{selected.icon}</span>}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected?.label ?? "Tous les ingrédients"}</span>
            </h2>
            <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
              {shown} fiche{shown > 1 ? "s" : ""}{search.trim() ? ` pour « ${search.trim()} »` : ""}
            </div>
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <BaseMenu count={ingredientDB.length} noun="ingrédient" {...transfer} />
              {category !== null && (
                <button className="btn btn-primary btn-pill" onClick={() => onCreate(category)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", fontSize: 13 }}>
                  <Icon name="plus" size={14} /> Ajouter
                </button>
              )}
            </div>
          )}
        </div>
        <div style={{ marginBottom: 18 }}>
          <UnderlineTabs label="Filtrer les ingrédients" value={filter} onChange={onFilter}
            tabs={filters.map(([value, label, count]) => ({ value, label, count }))} />
        </div>

        {groups.length === 0 ? (
          <div style={{ padding: "36px 4px", color: "var(--text3)", fontSize: 14, lineHeight: 1.5 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
              {search.trim() ? "Rien ne correspond à cette recherche" : filter ? "Rien à reprendre ici" : "Cette catégorie est encore vide"}
            </div>
            {search.trim() ? "Essaie un autre nom, ou un alias." : filter ? "Toutes les fiches de cette sélection sont à jour." : "Ajoute une première fiche pour la remplir."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {groups.map(group => {
              const cat = categories[group.category];
              return (
                <div key={group.category}>
                  {category === null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 4px 10px" }}>
                      {cat && <span style={{ fontSize: 16 }}>{cat.icon}</span>}
                      <span style={{ fontSize: 14, fontWeight: 650, color: "var(--text)" }}>{cat?.label ?? (group.category || "Sans catégorie")}</span>
                      <span style={{ fontSize: 13, color: "var(--text3)", fontVariantNumeric: "tabular-nums" }}>{group.items.length}</span>
                      {isAdmin && cat && (
                        <button className="icon-btn-soft ripple" onClick={() => onCreate(group.category)} title={`Ajouter dans ${cat.label}`}
                          style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", border: "none", background: "transparent", cursor: "pointer" }}>
                          <Icon name="plus" size={15} />
                        </button>
                      )}
                    </div>
                  )}
                  <div className="dash-surface ing-admin-grid">
                    {group.items.map(item => <IngredientRow key={item.id} item={item} onOpen={() => onOpen(item.id)} />)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
