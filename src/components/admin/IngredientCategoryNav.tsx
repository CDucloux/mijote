import { useState } from "react";
import { Icon } from "../ui/Icon.jsx";
import { sortedCategoryEntries } from "@/constants/categories.js";
import type { IngredientCategory } from "@/lib/data/referenceData.js";

interface IngredientCategoryNavProps {
  categories: Record<string, IngredientCategory>;
  /** Effectif par catégorie sous le filtre de suivi actif. */
  counts: Record<string, number>;
  total: number;
  value: string | null;
  onChange: (category: string | null) => void;
  /** Réordonne les catégories par glisser-déposer (desktop). */
  onReorder?: (fromKey: string, toKey: string) => void;
}

/**
 * Navigation par catégorie de la console Ingrédients : liste verticale au large
 * (réordonnable par glisser-déposer), rangée de pastilles défilante en mobile.
 * La bascule de forme vit dans `.ing-cats` (global.css).
 */
export function IngredientCategoryNav({ categories, counts, total, value, onChange, onReorder }: IngredientCategoryNavProps) {
  const [dragCat, setDragCat] = useState<string | null>(null);
  const [overCat, setOverCat] = useState<string | null>(null);
  const endDrag = () => { setDragCat(null); setOverCat(null); };
  return (
    <nav className="ing-cats" aria-label="Catégories">
      <button className="ing-cat ripple hover-neutral" data-active={value === null || undefined} aria-current={value === null || undefined} onClick={() => onChange(null)}>
        <span className="ing-cat-icon"><Icon name="grid" size={15} color="currentColor" /></span>
        <span className="ing-cat-label">Toutes</span>
        <span className="ing-cat-count">{total}</span>
      </button>
      {sortedCategoryEntries(categories).map(([key, cat]) => {
        const count = counts[key] ?? 0;
        return (
          <button key={key} className="ing-cat ripple hover-neutral" title={key}
            data-active={value === key || undefined} aria-current={value === key || undefined}
            data-drop={(overCat === key && dragCat !== null && dragCat !== key) || undefined}
            data-dragging={dragCat === key || undefined}
            data-empty={count === 0 || undefined}
            onClick={() => onChange(key)}
            draggable={!!onReorder}
            onDragStart={onReorder ? (e) => { setDragCat(key); e.dataTransfer.effectAllowed = "move"; } : undefined}
            onDragOver={onReorder ? (e) => { e.preventDefault(); if (key !== overCat) setOverCat(key); } : undefined}
            onDragLeave={onReorder ? () => { if (overCat === key) setOverCat(null); } : undefined}
            onDrop={onReorder ? (e) => { e.preventDefault(); if (dragCat && dragCat !== key) onReorder(dragCat, key); endDrag(); } : undefined}
            onDragEnd={onReorder ? endDrag : undefined}>
            <span className="ing-cat-icon" style={{ fontSize: 16 }}>{cat.icon}</span>
            <span className="ing-cat-label">{cat.label}</span>
            <span className="ing-cat-count">{count}</span>
            {onReorder && <span className="ing-cat-grip" aria-hidden="true"><Icon name="drag" size={14} color="currentColor" /></span>}
          </button>
        );
      })}
    </nav>
  );
}
