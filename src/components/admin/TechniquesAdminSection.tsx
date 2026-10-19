import { Icon } from "../ui/Icon.jsx";
import { AdminCollapse, CollapseChevron, RowActions, AddPill } from "./AdminPrimitives.jsx";
import { BaseImportExport } from "./BaseImportExport.jsx";
import { difficultyColor, DIFFICULTY_LABEL } from "./techniqueDifficulty.js";
import { TECHNIQUE_CATEGORIES } from "@/lib/household/dataYaml.js";
import { techniqueVisual } from "@/lib/recipes/techniqueDisplay.js";
import type { TechniqueEntry } from "@/lib/recipes/techniques.js";
import type { BaseTransfer } from "../../hooks/useMasterImports.js";

// Niveau de difficulté d'un geste : 5 pastilles, colorées vert→ambre→rouge.
function DifficultyPips({ level }: { level?: number }) {
  if (!level) return null;
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center" }} title={`Difficulté ${level}/5 · ${DIFFICULTY_LABEL[level]}`}>
      {[1, 2, 3, 4, 5].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= level ? difficultyColor(level) : "var(--surface3)" }} />)}
    </span>
  );
}

function TechniqueRow({ technique, first, isAdmin, onEdit, onDelete }: { technique: TechniqueEntry; first: boolean; isAdmin: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px", borderTop: first ? "none" : "1px solid var(--border)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{technique.name}</span>
          <DifficultyPips level={technique.difficulty} />
          {technique.source && <span style={{ fontSize: 10.5, color: "var(--text3)" }}>· {technique.source}</span>}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text2)", lineHeight: 1.5, margin: "5px 0 0" }}>{technique.definition}</p>
        {technique.aliases && technique.aliases.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
            {technique.aliases.map(a => <span key={a} style={{ fontSize: 10.5, color: "var(--text3)", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 6, padding: "1px 7px" }}>{a}</span>)}
          </div>
        )}
      </div>
      {isAdmin && (
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <RowActions onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}

interface TechniquesAdminSectionProps {
  techniques: TechniqueEntry[];
  isAdmin: boolean;
  openCats: Record<string, boolean>;
  onToggleCat: (key: string) => void;
  onCreate: (categoryKey: string) => void;
  onEdit: (technique: TechniqueEntry) => void;
  onDelete: (technique: TechniqueEntry) => void;
  transfer: BaseTransfer;
}

/**
 * Section « Techniques » : glossaire des gestes groupé par catégorie repliable.
 * L'admin voit toutes les catégories (pour ajouter partout), les autres
 * seulement celles qui ont des gestes.
 */
export function TechniquesAdminSection({ techniques, isAdmin, openCats, onToggleCat, onCreate, onEdit, onDelete, transfer }: TechniquesAdminSectionProps) {
  const byCat = Object.keys(TECHNIQUE_CATEGORIES)
    .map((c): [string, TechniqueEntry[]] => [c, techniques.filter(t => t.category === c).sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr"))])
    .filter(([, list]) => isAdmin || list.length);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }} className="slide-up">
      {!isAdmin && techniques.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "24px 16px", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 14 }}>
          Aucune technique pour l'instant.
        </div>
      )}

      {byCat.map(([catKey, list]) => {
        const isOpen = !!openCats[catKey];
        const catVis = techniqueVisual(catKey);
        return (
          <div key={catKey} style={{ background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px" }}>
              <button onClick={() => onToggleCat(catKey)} className="ripple" style={{ flex: 1, display: "flex", alignItems: "center", gap: 11, textAlign: "left", padding: 6, margin: -6, borderRadius: 10 }}>
                {/* Pastille d'icône colorée par catégorie, à gauche du nom du groupe. */}
                <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center", background: `color-mix(in srgb, ${catVis.color} 16%, transparent)` }}>
                  <Icon name={catVis.icon} size={16} color={catVis.color} />
                </span>
                <div style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {TECHNIQUE_CATEGORIES[catKey]} <span style={{ color: "var(--text3)", opacity: 0.7 }}>· {list.length}</span>
                </div>
                <CollapseChevron open={isOpen} />
              </button>
              {isAdmin && <AddPill onClick={() => onCreate(catKey)} />}
            </div>
            <AdminCollapse open={isOpen}>
              <div style={{ borderTop: "1px solid var(--border)" }}>
                {list.map((t, i) => (
                  <TechniqueRow key={t.id} technique={t} first={i === 0} isAdmin={isAdmin} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />
                ))}
                {list.length === 0 && (
                  <div style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--text3)", fontStyle: "italic" }}>Aucun geste dans cette catégorie.</div>
                )}
              </div>
            </AdminCollapse>
          </div>
        );
      })}

      {isAdmin && <BaseImportExport count={techniques.length} noun="technique" exportTitle="Exporter le glossaire" importTitle="Importer le glossaire" {...transfer} />}
    </div>
  );
}
