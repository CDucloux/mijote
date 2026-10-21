import { Icon } from "../ui/Icon.jsx";
import type { ReactNode } from "react";
import type { IconName } from "../ui/Icon.jsx";
import { countTrackingFilters } from "@/lib/food/ingredientTracking.js";
import type { IngredientTrackingFilter } from "@/lib/food/ingredientTracking.js";
import type { ConsoleSection } from "../../constants/tabs.js";
import type { IngredientDbItem, UtensilDbItem } from "@/lib/types.js";
import type { TechniqueEntry } from "@/lib/recipes/techniques.js";

// ─── DASHBOARD DE LA CONSOLE ADMIN ───────────────────────────────────────────
// Vue d'ensemble des bases master. Un seul élément domine : l'avancement de la
// validation des ingrédients (chiffre en grand, barre empilée validés / en cours).
// Le reste est groupé sur des surfaces flottantes sans bordure (pas une carte par
// chiffre) ; chaque ligne mène à la section filtrée correspondante.
// Desktop : deux colonnes (avancement + bases | à compléter) ; mobile : une colonne.

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 650, color: "var(--text2)", margin: "0 4px 10px" }}>{children}</div>;
}

// Pastille de légende cliquable : la puce de couleur mappe le segment de la barre.
function LegendPill({ color, value, label, onClick }: { color: string; value: number; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="pressable hover-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 14px 7px 12px", borderRadius: 999, border: "none", background: "var(--surface2)", cursor: "pointer", fontSize: 13, color: "var(--text2)" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <strong style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</strong> {label}
    </button>
  );
}

// Volumétrie d'une base : chiffre fort, libellé discret, flèche au survol.
function BaseStat({ icon, value, label, onClick }: { icon: IconName; value: number; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="pressable hover-neutral dash-card" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: "14px 14px 12px", borderRadius: 14, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 500, color: "var(--text3)" }}>
        <Icon name={icon} size={14} color="currentColor" />{label}
      </span>
      <span style={{ display: "flex", alignItems: "center", width: "100%", gap: 6 }}>
        <span style={{ fontFamily: "var(--ff-display)", fontSize: 30, fontWeight: 700, lineHeight: 1, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <span className="dash-chevron" style={{ marginLeft: "auto" }}><Icon name="forward" size={14} color="currentColor" /></span>
      </span>
    </button>
  );
}

// Ligne « à compléter » : manquants / total et une barre de complétude (ce qui est fait).
function TodoRow({ count, total, label, onClick }: { count: number; total: number; label: string; onClick?: () => void }) {
  const done = count === 0;
  const filled = pct(total - count, total);
  return (
    <button onClick={onClick} className="pressable hover-neutral dash-card" style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "13px 14px", borderRadius: 14, border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          {done
            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, color: "var(--ok)", flexShrink: 0 }}><Icon name="check" size={13} color="currentColor" /> Complet</span>
            : <span style={{ fontSize: 13, color: "var(--text3)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}><strong style={{ color: "var(--text)", fontWeight: 700 }}>{count}</strong> manquant{count > 1 ? "s" : ""}</span>}
        </div>
        <div style={{ height: 4, borderRadius: 999, background: "var(--surface3)", overflow: "hidden", marginTop: 9 }} aria-hidden="true">
          <div style={{ height: "100%", width: `${filled}%`, borderRadius: 999, background: done ? "var(--ok)" : "var(--accent)", transition: "width 0.5s ease" }} />
        </div>
      </div>
      <span className="dash-chevron"><Icon name="forward" size={14} color="currentColor" /></span>
    </button>
  );
}

/** Props du tableau de bord admin : bases master et callback de navigation. */
interface AdminDashboardProps {
  ingredientDB?: IngredientDbItem[];
  utensilDB?: UtensilDbItem[];
  techniques?: TechniqueEntry[];
  onGoto?: (section: ConsoleSection, filter?: IngredientTrackingFilter) => void;
}

export function AdminDashboard({ ingredientDB = [], utensilDB = [], techniques = [], onGoto }: AdminDashboardProps) {
  const ing = ingredientDB.length, ust = utensilDB.length, tech = techniques.length;
  const ustNoImg = utensilDB.filter(u => !u.image).length;
  const { "no-image": ingNoImg, "no-nutrition": ingNoNut, validated, draft } = countTrackingFilters(ingredientDB);
  const validatedPct = pct(validated, ing);

  return (
    <div className="slide-up dash-grid">
      <div className="dash-col">
        {/* Avancement : l'élément dominant du tableau de bord. */}
        <section className="dash-surface" style={{ padding: "22px 22px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text3)" }}>Ingrédients validés</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "6px 0 18px" }}>
            <span style={{ fontFamily: "var(--ff-display)", fontSize: 52, fontWeight: 700, lineHeight: 0.9, letterSpacing: "-0.02em", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
              {validatedPct}<span style={{ fontSize: 26, color: "var(--text3)" }}>%</span>
            </span>
            <span style={{ fontSize: 13, color: "var(--text3)", fontVariantNumeric: "tabular-nums" }}>{validated} sur {ing}</span>
          </div>
          {/* Barre empilée : validés puis en cours, le reste à démarrer. */}
          <div style={{ display: "flex", gap: 3, height: 8, borderRadius: 999, background: "var(--surface3)", overflow: "hidden" }} aria-hidden="true">
            <div style={{ width: `${pct(validated, ing)}%`, minWidth: validated ? 8 : 0, background: "var(--ok)", borderRadius: 999, transition: "width 0.5s ease" }} />
            <div style={{ width: `${pct(draft, ing)}%`, minWidth: draft ? 8 : 0, background: "var(--spice)", borderRadius: 999, transition: "width 0.5s ease" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <LegendPill color="var(--ok)" value={validated} label={`validé${validated > 1 ? "s" : ""}`} onClick={() => onGoto?.("ingredients", "validated")} />
            <LegendPill color="var(--spice)" value={draft} label="en cours" onClick={() => onGoto?.("ingredients", "draft")} />
          </div>
        </section>

        <section>
          <Label>Bases master</Label>
          <div className="dash-surface" style={{ display: "flex", gap: 2, padding: 4 }}>
            <BaseStat icon="leaf" value={ing} label="Ingrédients" onClick={() => onGoto?.("ingredients")} />
            <BaseStat icon="utensils" value={ust} label="Ustensiles" onClick={() => onGoto?.("ustensiles")} />
            <BaseStat icon="list2" value={tech} label="Techniques" onClick={() => onGoto?.("techniques")} />
          </div>
        </section>
      </div>

      <section className="dash-col">
        <div>
          <Label>À compléter</Label>
          <div className="dash-surface" style={{ display: "flex", flexDirection: "column", gap: 2, padding: 4 }}>
            <TodoRow count={ingNoImg} total={ing} label="Photos d'ingrédients" onClick={() => onGoto?.("ingredients", "no-image")} />
            <TodoRow count={ingNoNut} total={ing} label="Valeurs nutritionnelles" onClick={() => onGoto?.("ingredients", "no-nutrition")} />
            <TodoRow count={ustNoImg} total={ust} label="Photos d'ustensiles" onClick={() => onGoto?.("ustensiles")} />
          </div>
        </div>
      </section>
    </div>
  );
}
