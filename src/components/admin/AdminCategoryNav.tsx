import { useState } from "react";
import type { ReactNode } from "react";
import { Icon } from "../ui/Icon.jsx";

/** Une catégorie de la navigation : clé, libellé, glyphe et effectif. */
export interface AdminNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  count: number;
}

export interface AdminCategoryNavProps {
  items: AdminNavItem[];
  /** Effectif de « Toutes » (sous le filtre de suivi actif). */
  total: number;
  value: string | null;
  onChange: (category: string | null) => void;
  /** Réordonne les catégories par glisser-déposer (desktop) ; absent = ordre fixe. */
  onReorder?: (fromKey: string, toKey: string) => void;
}

/**
 * Navigation par catégorie des sections de la console : liste verticale au large
 * (réordonnable par glisser-déposer si `onReorder`), rangée de pastilles
 * défilante en mobile. La bascule de forme vit dans `.admin-cats` (global.css).
 */
export function AdminCategoryNav({ items, total, value, onChange, onReorder }: AdminCategoryNavProps) {
  const [dragCat, setDragCat] = useState<string | null>(null);
  const [overCat, setOverCat] = useState<string | null>(null);
  const endDrag = () => { setDragCat(null); setOverCat(null); };
  return (
    <nav className="admin-cats" aria-label="Catégories">
      <button className="admin-cat ripple hover-neutral" data-active={value === null || undefined} aria-current={value === null || undefined} onClick={() => onChange(null)}>
        <span className="admin-cat-icon"><Icon name="grid" size={15} color="currentColor" /></span>
        <span className="admin-cat-label">Toutes</span>
        <span className="admin-cat-count">{total}</span>
      </button>
      {items.map(({ key, label, icon, count }) => (
        <button key={key} className="admin-cat ripple hover-neutral" title={key}
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
          <span className="admin-cat-icon">{icon}</span>
          <span className="admin-cat-label">{label}</span>
          <span className="admin-cat-count">{count}</span>
          {onReorder && <span className="admin-cat-grip" aria-hidden="true"><Icon name="drag" size={14} color="currentColor" /></span>}
        </button>
      ))}
    </nav>
  );
}
