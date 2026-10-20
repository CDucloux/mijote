import { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { IngImage } from "../ui/Img.jsx";
import { IngredientStatusBadge } from "../badges/IngredientStatusBadge.jsx";
import { UnderlineTabs } from "../ui/UnderlineTabs.jsx";
import { AdminCollapse, CollapseChevron, MasterBadge, AddPill } from "./AdminPrimitives.jsx";
import { BaseImportExport } from "./BaseImportExport.jsx";
import { countTrackingFilters, matchesTrackingFilter } from "@/lib/food/ingredientTracking.js";
import type { IngredientTrackingFilter } from "@/lib/food/ingredientTracking.js";
import { sortedCategoryEntries } from "@/constants/categories.js";
import type { IngredientDbItem } from "@/lib/types.js";
import type { IngredientCategory } from "@/lib/data/referenceData.js";
import type { BaseTransfer } from "../../hooks/useMasterImports.js";

function IngredientRowButton({ item, first, onOpen }: { item: IngredientDbItem; first: boolean; onOpen: () => void }) {
  return (
    <button onClick={onOpen} title="Voir la fiche" className="ing-row-btn ripple hover-neutral" style={{
      width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
      borderTop: first ? "none" : "1px solid var(--border)",
      background: "var(--surface)", textAlign: "left", cursor: "pointer", border: "none",
    }}>
      <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>
        <IngImage src={item.image} alt={item.name} size={42} />
        <IngredientStatusBadge status={item.status} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--accent)", marginTop: 2, fontWeight: 600 }}>
          <Icon name="fileText" size={10} color="var(--accent)" /> Découvrir la fiche
        </div>
      </div>
      {item._ro === true && <MasterBadge />}
      <Icon name="forward" size={14} color="var(--text3)" />
    </button>
  );
}

interface IngredientsAdminSectionProps {
  ingredientDB: IngredientDbItem[];
  categories: Record<string, IngredientCategory>;
  isAdmin: boolean;
  filter: IngredientTrackingFilter | null;
  onFilter: (filter: IngredientTrackingFilter | null) => void;
  openCats: Record<string, boolean>;
  onToggleCat: (key: string) => void;
  onReorder: (fromKey: string, toKey: string) => void;
  onCreate: (categoryKey: string) => void;
  onOpen: (id: string) => void;
  transfer: BaseTransfer;
}

/**
 * Section « Ingrédients » : catégories repliables (réordonnables par glisser-déposer
 * côté admin), filtre de suivi éditorial, et import / export de la base.
 */
export function IngredientsAdminSection({ ingredientDB, categories, isAdmin, filter, onFilter, openCats, onToggleCat, onReorder, onCreate, onOpen, transfer }: IngredientsAdminSectionProps) {
  const [dragCat, setDragCat] = useState<string | null>(null); // catégorie en cours de glisser
  const [overCat, setOverCat] = useState<string | null>(null); // cible de dépôt survolée
  const counts = countTrackingFilters(ingredientDB);
  const filters: [IngredientTrackingFilter | null, string, number][] = [[null, "Tous", counts.all], ["draft", "En cours", counts.draft], ["validated", "Validés", counts.validated], ["no-image", "Sans photo", counts["no-image"]], ["no-nutrition", "Sans nutrition", counts["no-nutrition"]]];
  const endDrag = () => { setDragCat(null); setOverCat(null); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Filtre de suivi (piloté aussi par le dashboard) */}
      <div style={{ marginBottom: 4 }}>
        <UnderlineTabs label="Filtrer les ingrédients" value={filter} onChange={onFilter}
          tabs={filters.map(([value, label, count]) => ({ value, label, count }))} />
      </div>
      {sortedCategoryEntries(categories).map(([catKey, cat], ci) => {
        const catIngs = ingredientDB.filter(d => d.category === catKey && matchesTrackingFilter(d, filter))
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" }));
        if (filter && catIngs.length === 0) return null; // sous filtre : on masque les catégories vides
        const isOpen = filter ? true : !!openCats[catKey];
        const dropTarget = overCat === catKey && dragCat !== null && dragCat !== catKey;
        return (
          <div key={catKey} className="slide-up"
            draggable={isAdmin}
            onDragStart={isAdmin ? (e) => { setDragCat(catKey); e.dataTransfer.effectAllowed = "move"; } : undefined}
            onDragOver={isAdmin ? (e) => { e.preventDefault(); if (catKey !== overCat) setOverCat(catKey); } : undefined}
            onDragLeave={isAdmin ? () => { if (overCat === catKey) setOverCat(null); } : undefined}
            onDrop={isAdmin ? (e) => { e.preventDefault(); if (dragCat && dragCat !== catKey) onReorder(dragCat, catKey); endDrag(); } : undefined}
            onDragEnd={isAdmin ? endDrag : undefined}
            style={{
              background: "var(--surface)", borderRadius: 14, overflow: "hidden",
              border: `1px solid ${dropTarget ? "var(--accent)" : "var(--border)"}`,
              opacity: dragCat === catKey ? 0.4 : 1,
              boxShadow: dropTarget ? "0 0 0 2px var(--accent)" : "none",
              transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.15s",
              animationDelay: `${ci * 0.04}s`,
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
              {isAdmin && (
                <span style={{ cursor: "grab", color: "var(--text3)", display: "flex", flexShrink: 0, touchAction: "none" }} title="Glisser pour réordonner">
                  <Icon name="drag" size={16} color="var(--text3)" />
                </span>
              )}
              <button onClick={() => onToggleCat(catKey)} className="ripple" style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 6, margin: -6, borderRadius: 10 }}>
                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{cat.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{catIngs.length} ingrédient{catIngs.length !== 1 ? "s" : ""} · <code style={{ fontSize: 10, background: "var(--surface2)", borderRadius: 4, padding: "1px 4px" }}>{catKey}</code></div>
                </div>
                <CollapseChevron open={isOpen} />
              </button>
              {isAdmin && <AddPill onClick={() => onCreate(catKey)} />}
            </div>
            <AdminCollapse open={isOpen}>
              <div style={{ borderTop: "1px solid var(--border)" }}>
                {catIngs.length === 0 && (
                  <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--text3)", fontStyle: "italic" }}>
                    Aucun ingrédient dans cette catégorie.
                  </div>
                )}
                {catIngs.map((item, i) => <IngredientRowButton key={item.id} item={item} first={i === 0} onOpen={() => onOpen(item.id)} />)}
              </div>
            </AdminCollapse>
          </div>
        );
      })}

      {isAdmin && <BaseImportExport count={ingredientDB.length} noun="ingrédient" {...transfer} />}
    </div>
  );
}
