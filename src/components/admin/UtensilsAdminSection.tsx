import { UtImage } from "../recipe/StepPills.jsx";
import { MasterBadge, RowActions } from "./AdminPrimitives.jsx";
import { BaseImportExport } from "./BaseImportExport.jsx";
import { UTENSIL_CATEGORIES } from "@/lib/household/dataYaml.js";
import type { UtensilDbItem } from "@/lib/types.js";
import type { BaseTransfer } from "../../hooks/useMasterImports.js";

interface UtensilsAdminSectionProps {
  utensilDB: UtensilDbItem[];
  isAdmin: boolean;
  onEdit: (item: UtensilDbItem) => void;
  onDelete: (item: UtensilDbItem) => void;
  transfer: BaseTransfer;
}

/**
 * Section « Ustensiles » : grille groupée par famille (taxonomie fixe
 * `UTENSIL_CATEGORIES`, les entrées sans catégorie retombent dans « divers »).
 */
export function UtensilsAdminSection({ utensilDB, isAdmin, onEdit, onDelete, transfer }: UtensilsAdminSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {Object.entries(UTENSIL_CATEGORIES).map(([catKey, catLabel], ci) => {
        const list = utensilDB
          .filter(d => (d.category || "divers") === catKey)
          .sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"));
        if (list.length === 0) return null; // famille vide : masquée
        return (
          <div key={catKey} className="slide-up" style={{ animationDelay: `${ci * 0.04}s` }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "2px 2px 10px" }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{catLabel}</span>
              <span style={{ fontSize: 11, color: "var(--text3)" }}>{list.length}</span>
              <code style={{ fontSize: 10, color: "var(--text3)", background: "var(--surface2)", borderRadius: 4, padding: "1px 5px" }}>{catKey}</code>
            </div>
            <div className="config-ut-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {list.map((item, ui) => (
                <div key={item.id} className="slide-up" style={{ background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)", padding: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, animationDelay: `${ui * 0.03}s` }}>
                  <UtImage src={item.image} alt={item.name} size={50} radius={10} />
                  <span style={{ fontSize: 13, fontWeight: 500, textAlign: "center" }}>{item.name}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {item._ro ? <MasterBadge /> : <RowActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {isAdmin && <BaseImportExport count={utensilDB.length} noun="ustensile" {...transfer} />}
    </div>
  );
}
