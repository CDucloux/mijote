import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../ui/Icon.jsx";
import { SearchField } from "../ui/SearchField.jsx";
import { AdminCategoryNav } from "./AdminCategoryNav.jsx";
import type { AdminCategoryNavProps } from "./AdminCategoryNav.jsx";
import { useLS } from "../../hooks/useLS.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";

interface AdminTwoPaneProps {
  search: string;
  onSearch: (search: string) => void;
  searchPlaceholder: string;
  nav: AdminCategoryNavProps;
  /** Glyphe de la catégorie affichée, devant le titre. */
  icon?: ReactNode;
  title: string;
  /** Effectif affiché sous le titre. */
  shown: number;
  /** Actions à droite du titre (menu « Base », « Ajouter »). */
  actions?: ReactNode;
  /** Onglets de suivi éditorial, sous le titre. */
  tabs?: ReactNode;
  /** Un filtre de suivi restreint la sélection (choisit le message d'état vide). */
  filtered: boolean;
  children: ReactNode;
}

/**
 * Gabarit commun des sections Ingrédients, Ustensiles et Techniques de la
 * console : au large, deux volets (recherche et catégories à gauche, repliables ;
 * entrées de la sélection à droite), une colonne en mobile.
 */
export function AdminTwoPane({ search, onSearch, searchPlaceholder, nav, icon, title, shown, actions, tabs, filtered, children }: AdminTwoPaneProps) {
  // Volet gauche repliable au large seulement (en mobile, les catégories sont une rangée de pastilles).
  const [asideOpen, setAsideOpen] = useLS("rf_adminAsideOpen", true);
  const canFold = useMediaQuery("(min-width: 900px)"); // même seuil que `.admin-pane` (global.css)
  const query = search.trim();
  const empty = emptyState(shown, query, filtered);
  return (
    <div className="slide-up admin-pane" data-folded={(canFold && !asideOpen) || undefined}>
      <aside className="admin-pane-aside" inert={canFold && !asideOpen}>
        <SearchField value={search} onChange={onSearch} placeholder={searchPlaceholder} />
        <AdminCategoryNav {...nav} />
      </aside>

      <section style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
          <div style={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: 12 }}>
            {canFold && (
              <button className="icon-btn-soft ripple admin-fold" onClick={() => setAsideOpen(o => !o)}
                aria-expanded={asideOpen} title={asideOpen ? "Masquer les catégories" : "Afficher les catégories"}>
                <Icon name="sidebar" size={18} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 650, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                {icon && <span style={{ display: "inline-flex", fontSize: 24 }}>{icon}</span>}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
              </h2>
              <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                {shown} fiche{shown > 1 ? "s" : ""}{query ? ` pour « ${query} »` : ""}
              </div>
            </div>
          </div>
          {actions && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{actions}</div>}
        </div>
        <div style={{ marginBottom: 18, minHeight: tabs ? undefined : 8 }}>{tabs}</div>

        {empty ? (
          <div style={{ padding: "36px 4px", color: "var(--text3)", fontSize: 14, lineHeight: 1.5 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{empty.title}</div>
            {empty.body}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>{children}</div>
        )}
      </section>
    </div>
  );
}

// État vide d'une sélection, selon ce qui la restreint (recherche, filtre de
// suivi ou catégorie vide) : une seule voix pour les trois sections.
function emptyState(shown: number, query: string, filtered: boolean): { title: string; body: string } | null {
  if (shown > 0) return null;
  if (query) return { title: "Rien ne correspond à cette recherche", body: "Essaie un autre nom, ou un alias." };
  if (filtered) return { title: "Rien à reprendre ici", body: "Toutes les fiches de cette sélection sont à jour." };
  return { title: "Cette catégorie est encore vide", body: "Ajoute une première fiche pour la remplir." };
}

interface AdminGroupProps {
  icon?: ReactNode;
  label: string;
  count: number;
  /** En-tête de groupe : seulement sous « Toutes » (sinon le titre du volet suffit). */
  showHeader: boolean;
  onAdd?: () => void;
  /** Largeur minimale d'une colonne de la grille (px). */
  minColumn?: number;
  children: ReactNode;
}

/** Groupe d'une catégorie : en-tête discret puis grille d'entrées sur surface flottante. */
export function AdminGroup({ icon, label, count, showHeader, onAdd, minColumn = 260, children }: AdminGroupProps) {
  return (
    <div>
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 4px 10px" }}>
          {icon && <span style={{ display: "inline-flex", fontSize: 16 }}>{icon}</span>}
          <span style={{ fontSize: 14, fontWeight: 650, color: "var(--text)" }}>{label}</span>
          <span style={{ fontSize: 13, color: "var(--text3)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
          {onAdd && (
            <button className="icon-btn-soft ripple" onClick={onAdd} title={`Ajouter dans ${label}`}
              style={{ marginLeft: "auto", width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", border: "none", background: "transparent", cursor: "pointer" }}>
              <Icon name="plus" size={15} />
            </button>
          )}
        </div>
      )}
      <div className="dash-surface admin-grid" style={{ "--admin-col-min": `${minColumn}px` } as CSSProperties}>{children}</div>
    </div>
  );
}

interface AdminRowProps {
  media: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** Sous-titre en vert (fiche terminée) plutôt qu'en gris. */
  done?: boolean;
  /** Éléments à droite (badge, niveau…), avant le chevron. */
  trailing?: ReactNode;
  /** Absent : ligne en lecture seule (pas de chevron). */
  onClick?: () => void;
  /** Aligne le média en haut (sous-titre sur plusieurs lignes). */
  alignTop?: boolean;
}

/** Ligne d'entrée de la console : une seule action, ouvrir la fiche ou l'éditeur. */
export function AdminRow({ media, title, subtitle, done = false, trailing, onClick, alignTop = false }: AdminRowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={onClick ? "ripple hover-neutral dash-card" : undefined} style={{
      width: "100%", minWidth: 0, display: "flex", alignItems: alignTop ? "flex-start" : "center", gap: 12, padding: "9px 12px 9px 10px",
      borderRadius: 14, border: "none", background: "transparent", textAlign: "left", cursor: onClick ? "pointer" : "default", color: "inherit", font: "inherit",
    }}>
      <span style={{ position: "relative", flexShrink: 0, display: "inline-flex" }}>{media}</span>
      <span style={{ flex: 1, minWidth: 0, alignSelf: "center" }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        {subtitle && <span className="admin-row-sub" style={{ display: "block", fontSize: 12, lineHeight: 1.45, color: done ? "var(--ok)" : "var(--text3)", marginTop: 2 }}>{subtitle}</span>}
      </span>
      {trailing}
      {onClick && <span className="dash-chevron" style={{ alignSelf: "center" }}><Icon name="forward" size={14} color="currentColor" /></span>}
    </Tag>
  );
}
