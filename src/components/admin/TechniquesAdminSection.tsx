import { Icon } from "../ui/Icon.jsx";
import { UnderlineTabs } from "../ui/UnderlineTabs.jsx";
import { BaseMenu } from "./BaseMenu.jsx";
import { AdminTwoPane, AdminGroup, AdminRow } from "./AdminTwoPane.jsx";
import { difficultyColor, DIFFICULTY_LABEL } from "./techniqueDifficulty.js";
import { TECHNIQUE_CATEGORIES } from "@/lib/household/dataYaml.js";
import { techniqueVisual } from "@/lib/recipes/techniqueDisplay.js";
import { countTechniquesByCategory, groupAdminTechniques, matchesTechniqueFilter } from "@/lib/admin/catalogViews.js";
import type { TechniqueFilter } from "@/lib/admin/catalogViews.js";
import type { TechniqueEntry } from "@/lib/recipes/techniques.js";
import type { BaseTransfer } from "../../hooks/useMasterImports.js";

// Niveau de difficulté d'un geste : 5 pastilles, colorées vert→ambre→rouge.
function DifficultyPips({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", flexShrink: 0, alignSelf: "center" }} title={`Difficulté ${level}/5 · ${DIFFICULTY_LABEL[level]}`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= level ? difficultyColor(level) : "var(--surface3)" }} />)}
    </span>
  );
}

// Glyphe coloré d'une catégorie de geste (même identité qu'en recette).
function CategoryGlyph({ category, size }: { category: string; size: number }) {
  const vis = techniqueVisual(category);
  return <Icon name={vis.icon} size={size} color={vis.color} />;
}

/** Liste de gestes affichée : catégorie, recherche et filtre de suivi. */
export interface TechniqueListView {
  category: string | null;
  search: string;
  filter: TechniqueFilter | null;
}

interface TechniquesAdminSectionProps {
  techniques: TechniqueEntry[];
  isAdmin: boolean;
  view: TechniqueListView;
  onView: (patch: Partial<TechniqueListView>) => void;
  onCreate: (categoryKey: string) => void;
  onEdit: (technique: TechniqueEntry) => void;
  transfer: BaseTransfer;
}

/**
 * Section « Techniques » : glossaire des gestes par catégorie, filtre « sans
 * difficulté », définition en aperçu, éditeur en feuille.
 */
export function TechniquesAdminSection({ techniques, isAdmin, view, onView, onCreate, onEdit, transfer }: TechniquesAdminSectionProps) {
  const { category, search, filter } = view;
  const cats = Object.entries(TECHNIQUE_CATEGORIES);
  const groups = groupAdminTechniques(techniques, cats.map(([key]) => key), view);
  const perCategory = countTechniquesByCategory(techniques, filter);
  const noLevel = techniques.filter(t => matchesTechniqueFilter(t, "no-difficulty")).length;
  const filters: [TechniqueFilter | null, string, number][] = [[null, "Tous", techniques.length], ["no-difficulty", "Sans difficulté", noLevel]];
  const addTo = category ?? cats[0]?.[0];

  return (
    <AdminTwoPane search={search} onSearch={s => onView({ search: s })} searchPlaceholder="Rechercher un geste"
      nav={{ items: cats.map(([key, label]) => ({ key, label, icon: <CategoryGlyph category={key} size={15} />, count: perCategory[key] ?? 0 })), total: filter ? noLevel : techniques.length, value: category, onChange: c => onView({ category: c }) }}
      icon={category !== null ? <CategoryGlyph category={category} size={24} /> : undefined} title={category !== null ? TECHNIQUE_CATEGORIES[category] ?? category : "Tous les gestes"}
      shown={groups.reduce((n, g) => n + g.items.length, 0)} filtered={filter !== null}
      actions={isAdmin && (<>
        <BaseMenu count={techniques.length} noun="geste" importTitle="Importer le glossaire" {...transfer} />
        {addTo && (
          <button className="btn btn-primary btn-pill" onClick={() => onCreate(addTo)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", fontSize: 13 }}>
            <Icon name="plus" size={14} /> Ajouter
          </button>
        )}
      </>)}
      tabs={<UnderlineTabs label="Filtrer les gestes" value={filter} onChange={f => onView({ filter: f })} tabs={filters.map(([value, label, count]) => ({ value, label, count }))} />}>
      {groups.map(group => {
        const vis = techniqueVisual(group.category);
        return (
          <AdminGroup key={group.category} icon={<CategoryGlyph category={group.category} size={16} />} label={TECHNIQUE_CATEGORIES[group.category] ?? (group.category || "Sans catégorie")} count={group.items.length}
            showHeader={category === null} onAdd={isAdmin && group.category in TECHNIQUE_CATEGORIES ? () => onCreate(group.category) : undefined} minColumn={340}>
            {group.items.map(t => (
              <AdminRow key={t.id} onClick={isAdmin ? () => onEdit(t) : undefined} title={t.name || "Sans nom"} alignTop
                subtitle={<span className="admin-clamp-2">{t.definition}</span>}
                media={<span style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${vis.color} 14%, transparent)` }}><Icon name={vis.icon} size={18} color={vis.color} /></span>}
                trailing={<DifficultyPips level={t.difficulty} />} />
            ))}
          </AdminGroup>
        );
      })}
    </AdminTwoPane>
  );
}
