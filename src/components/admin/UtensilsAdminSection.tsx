import { Icon } from "../ui/Icon.jsx";
import type { IconName } from "../ui/Icon.jsx";
import { UnderlineTabs } from "../ui/UnderlineTabs.jsx";
import { UtImage } from "../recipe/StepPills.jsx";
import { MasterBadge } from "./AdminPrimitives.jsx";
import { BaseMenu } from "./BaseMenu.jsx";
import { AdminTwoPane, AdminGroup, AdminRow } from "./AdminTwoPane.jsx";
import { UTENSIL_CATEGORIES } from "@/lib/household/dataYaml.js";
import { APPLIANCE_LABELS, isApplianceKey } from "@/lib/utensils/appliances.js";
import { countUtensilsByCategory, groupAdminUtensils, matchesUtensilFilter } from "@/lib/admin/catalogViews.js";
import type { UtensilFilter } from "@/lib/admin/catalogViews.js";
import type { UtensilDbItem } from "@/lib/types.js";
import type { BaseTransfer } from "../../hooks/useMasterImports.js";

// Glyphe de chaque famille d'ustensiles (taxonomie fixe), pour la navigation.
const FAMILY_ICON: Record<string, IconName> = {
  cuisson: "fire", appareils: "bolt", decoupe: "knife", mesure: "portions",
  preparation: "spoon", patisserie: "chef", filtrage: "funnel", divers: "utensils",
};
const familyIcon = (key: string, size: number) => <Icon name={FAMILY_ICON[key] ?? "utensils"} size={size} color="currentColor" />;

/** Liste d'ustensiles affichée : famille, recherche et filtre de suivi. */
export interface UtensilListView {
  category: string | null;
  search: string;
  filter: UtensilFilter | null;
}

interface UtensilsAdminSectionProps {
  utensilDB: UtensilDbItem[];
  isAdmin: boolean;
  view: UtensilListView;
  onView: (patch: Partial<UtensilListView>) => void;
  onCreate: (categoryKey: string) => void;
  onEdit: (item: UtensilDbItem) => void;
  transfer: BaseTransfer;
}

/**
 * Section « Ustensiles » : familles fixes (`UTENSIL_CATEGORIES`, les entrées sans
 * famille retombent dans « divers »), filtre « sans photo », éditeur en feuille.
 */
export function UtensilsAdminSection({ utensilDB, isAdmin, view, onView, onCreate, onEdit, transfer }: UtensilsAdminSectionProps) {
  const { category, search, filter } = view;
  const families = Object.entries(UTENSIL_CATEGORIES);
  const groups = groupAdminUtensils(utensilDB, families.map(([key]) => key), view);
  const perFamily = countUtensilsByCategory(utensilDB, filter);
  const noImage = utensilDB.filter(u => matchesUtensilFilter(u, "no-image")).length;
  const filters: [UtensilFilter | null, string, number][] = [[null, "Tous", utensilDB.length], ["no-image", "Sans photo", noImage]];

  return (
    <AdminTwoPane search={search} onSearch={s => onView({ search: s })} searchPlaceholder="Rechercher un ustensile"
      nav={{ items: families.map(([key, label]) => ({ key, label, icon: familyIcon(key, 15), count: perFamily[key] ?? 0 })), total: filter ? noImage : utensilDB.length, value: category, onChange: c => onView({ category: c }) }}
      icon={category !== null ? familyIcon(category, 24) : undefined} title={category !== null ? UTENSIL_CATEGORIES[category] ?? category : "Tous les ustensiles"}
      shown={groups.reduce((n, g) => n + g.items.length, 0)} filtered={filter !== null}
      actions={isAdmin && (<>
        <BaseMenu count={utensilDB.length} noun="ustensile" {...transfer} />
        <button className="btn btn-primary btn-pill" onClick={() => onCreate(category ?? "divers")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", fontSize: 13 }}>
          <Icon name="plus" size={14} /> Ajouter
        </button>
      </>)}
      tabs={<UnderlineTabs label="Filtrer les ustensiles" value={filter} onChange={f => onView({ filter: f })} tabs={filters.map(([value, label, count]) => ({ value, label, count }))} />}>
      {groups.map(group => (
        <AdminGroup key={group.category} icon={familyIcon(group.category, 16)} label={UTENSIL_CATEGORIES[group.category] ?? group.category} count={group.items.length}
          showHeader={category === null} onAdd={isAdmin ? () => onCreate(group.category) : undefined} minColumn={220}>
          {group.items.map(item => (
            <AdminRow key={item.id} onClick={item._ro ? undefined : () => onEdit(item)} title={item.name || "Sans nom"}
              subtitle={!item.image ? "Sans photo" : isApplianceKey(item.appliance) ? APPLIANCE_LABELS[item.appliance] : undefined}
              media={<UtImage src={item.image} alt={item.name} size={42} radius={12} />}
              trailing={item._ro && <MasterBadge />} />
          ))}
        </AdminGroup>
      ))}
    </AdminTwoPane>
  );
}
