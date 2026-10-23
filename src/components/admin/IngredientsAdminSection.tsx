import { Icon } from "../ui/Icon.jsx";
import { IngImage } from "../ui/Img.jsx";
import { IngredientStatusBadge } from "../badges/IngredientStatusBadge.jsx";
import { UnderlineTabs } from "../ui/UnderlineTabs.jsx";
import { MasterBadge } from "./AdminPrimitives.jsx";
import { BaseMenu } from "./BaseMenu.jsx";
import { AdminTwoPane, AdminGroup, AdminRow } from "./AdminTwoPane.jsx";
import { countTrackingFilters, matchesTrackingFilter } from "@/lib/food/ingredientTracking.js";
import type { IngredientTrackingFilter } from "@/lib/food/ingredientTracking.js";
import { countByCategory, groupAdminIngredients } from "@/lib/food/ingredientAdminView.js";
import { sortedCategoryEntries } from "@/constants/categories.js";
import type { IngredientDbItem } from "@/lib/types.js";
import type { IngredientCategory } from "@/lib/data/referenceData.js";
import type { BaseTransfer } from "../../hooks/useMasterImports.js";

// Ce qu'il reste à rédiger sur une fiche, en sous-titre de sa ligne.
function rowHint(item: IngredientDbItem): { text: string; done: boolean } {
  if (item.status === "validated") return { text: "Validé", done: true };
  const gaps = [matchesTrackingFilter(item, "no-image") && "photo", matchesTrackingFilter(item, "no-nutrition") && "nutrition"].filter(Boolean);
  return { text: gaps.length ? `Sans ${gaps.join(" ni ")}` : "En cours de rédaction", done: false };
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
 * Section « Ingrédients » : catégories réordonnables, filtre de suivi éditorial
 * (piloté aussi par le tableau de bord), fiches groupées par catégorie.
 */
export function IngredientsAdminSection({ ingredientDB, categories, isAdmin, filter, onFilter, category, onCategory, search, onSearch, onReorder, onCreate, onOpen, transfer }: IngredientsAdminSectionProps) {
  const counts = countTrackingFilters(ingredientDB);
  const filters: [IngredientTrackingFilter | null, string, number][] = [[null, "Tous", counts.all], ["draft", "En cours", counts.draft], ["validated", "Validés", counts.validated], ["no-image", "Sans photo", counts["no-image"]], ["no-nutrition", "Sans nutrition", counts["no-nutrition"]]];
  const entries = sortedCategoryEntries(categories);
  const groups = groupAdminIngredients(ingredientDB, entries.map(([key]) => key), { category, filter, search });
  const perCategory = countByCategory(ingredientDB, filter);
  const selected = category !== null ? categories[category] : undefined;
  const addTo = category ?? entries[0]?.[0];

  return (
    <AdminTwoPane search={search} onSearch={onSearch} searchPlaceholder="Rechercher un ingrédient"
      nav={{ items: entries.map(([key, cat]) => ({ key, label: cat.label, icon: cat.icon, count: perCategory[key] ?? 0 })), total: filter ? counts[filter] : counts.all, value: category, onChange: onCategory, onReorder: isAdmin ? onReorder : undefined }}
      icon={selected?.icon} title={selected?.label ?? "Tous les ingrédients"} shown={groups.reduce((n, g) => n + g.items.length, 0)} filtered={filter !== null}
      actions={isAdmin && (<>
        <BaseMenu count={ingredientDB.length} noun="ingrédient" {...transfer} />
        {addTo && (
          <button className="btn btn-primary btn-pill" onClick={() => onCreate(addTo)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", fontSize: 13 }}>
            <Icon name="plus" size={14} /> Ajouter
          </button>
        )}
      </>)}
      tabs={<UnderlineTabs label="Filtrer les ingrédients" value={filter} onChange={onFilter} tabs={filters.map(([value, label, count]) => ({ value, label, count }))} />}>
      {groups.map(group => {
        const cat = categories[group.category];
        return (
          <AdminGroup key={group.category} icon={cat?.icon} label={cat?.label ?? (group.category || "Sans catégorie")} count={group.items.length}
            showHeader={category === null} onAdd={isAdmin && cat ? () => onCreate(group.category) : undefined}>
            {group.items.map(item => {
              const hint = rowHint(item);
              return (
                <AdminRow key={item.id} onClick={() => onOpen(item.id)} title={item.name || "Sans nom"} subtitle={hint.text} done={hint.done}
                  media={<><IngImage src={item.image} alt={item.name} size={42} /><IngredientStatusBadge status={item.status} size={16} ring="var(--float-surface)" /></>}
                  trailing={item._ro === true && <MasterBadge />} />
              );
            })}
          </AdminGroup>
        );
      })}
    </AdminTwoPane>
  );
}
