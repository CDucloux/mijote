import { Icon } from "../ui/Icon.jsx";
import type { ReactNode } from "react";
import type { IconName } from "../ui/Icon.jsx";
import { countTrackingFilters } from "@/lib/food/ingredientTracking.js";
import type { IngredientDbItem, UtensilDbItem } from "@/lib/types.js";
import type { TechniqueEntry } from "@/lib/recipes/techniques.js";

// ─── DASHBOARD DE LA CONSOLE ADMIN ───────────────────────────────────────────
// Vue d'ensemble des bases master : volumétrie, avancement de la validation des
// ingrédients, et pistes « à compléter » (sans photo / sans nutrition). Chaque
// carte est actionnable et amène à la section filtrée correspondante.

const CARD = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18 } as const;

interface StatTileProps {
  icon: IconName;
  tint: string;
  color: string;
  value: number;
  label: string;
  onClick?: () => void;
}

function StatTile({ icon, tint, color, value, label, onClick }: StatTileProps) {
  return (
    <button onClick={onClick} className="pressable dash-card" style={{ ...CARD, padding: 16, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 11, width: "100%" }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, background: tint, display: "grid", placeItems: "center" }}><Icon name={icon} size={19} color={color} /></span>
      <div>
        <div style={{ fontFamily: "var(--ff-display)", fontSize: 28, fontWeight: 700, lineHeight: 1, color: "var(--text)" }}>{value}</div>
        <div style={{ fontSize: 12.5, color: "var(--text3)", fontWeight: 500, marginTop: 5 }}>{label}</div>
      </div>
    </button>
  );
}

interface TodoCardProps {
  icon: IconName;
  count: number;
  total: number;
  label: string;
  onClick?: () => void;
}

function TodoCard({ icon, count, total, label, onClick }: TodoCardProps) {
  const done = count === 0;
  return (
    <button onClick={onClick} className="pressable dash-card" style={{ ...CARD, padding: "13px 15px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, width: "100%",
      background: done ? "rgba(var(--ok-rgb),0.06)" : "var(--surface)", borderColor: done ? "rgba(var(--ok-rgb),0.3)" : "var(--border)" }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: done ? "rgba(var(--ok-rgb),0.14)" : "rgba(232,146,10,0.14)", display: "grid", placeItems: "center" }}>
        <Icon name={done ? "check" : icon} size={18} color={done ? "var(--ok)" : "#e8920a"} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: done ? "var(--ok)" : "var(--text)", fontVariantNumeric: "tabular-nums" }}>
          {done ? "Complet" : count}{!done && <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text3)" }}> / {total}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>{label}</div>
      </div>
      <span className="dash-chevron"><Icon name="forward" size={15} color="currentColor" /></span>
    </button>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.09em", margin: "0 2px 11px" }}>{children}</div>;
}

/** Props du tableau de bord admin : bases master et callback de navigation. */
interface AdminDashboardProps {
  ingredientDB?: IngredientDbItem[];
  utensilDB?: UtensilDbItem[];
  techniques?: TechniqueEntry[];
  onGoto?: (section: string, filter?: string) => void;
}

export function AdminDashboard({ ingredientDB = [], utensilDB = [], techniques = [], onGoto }: AdminDashboardProps) {
  const ing = ingredientDB.length, ust = utensilDB.length, tech = techniques.length;
  const ustNoImg = utensilDB.filter(u => !u.image).length;
  const { "no-image": ingNoImg, "no-nutrition": ingNoNut, validated, draft } = countTrackingFilters(ingredientDB);
  const pct = ing ? Math.round((validated / ing) * 100) : 0;

  return (
    <div className="slide-up" style={{ display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Avancement de la validation */}
      <div style={{ ...CARD, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 15 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
            <span style={{ width: 28, height: 28, borderRadius: 9, background: "rgba(var(--ok-rgb),0.14)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="check" size={15} color="var(--ok)" /></span>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>Avancement des ingrédients</span>
          </div>
          <span style={{ fontFamily: "var(--ff-display)", fontSize: 23, fontWeight: 700, color: "var(--ok)", fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
        </div>
        <div style={{ height: 10, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: "linear-gradient(90deg, #4caf7d, #7ccf9f)", transition: "width 0.5s ease" }} />
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 13 }}>
          <button onClick={() => onGoto?.("ingredients", "validated")} className="pressable dash-legend" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--ok)" }} />
            <span style={{ fontSize: 12.5, color: "var(--text2)" }}><strong style={{ color: "var(--text)" }}>{validated}</strong> validés</span>
          </button>
          <button onClick={() => onGoto?.("ingredients", "draft")} className="pressable dash-legend" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e8920a" }} />
            <span style={{ fontSize: 12.5, color: "var(--text2)" }}><strong style={{ color: "var(--text)" }}>{draft}</strong> en cours</span>
          </button>
        </div>
      </div>

      {/* Bases master */}
      <div>
        <Label>Bases master</Label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <StatTile icon="leaf" tint="rgba(var(--ok-rgb),0.14)" color="var(--ok)" value={ing} label="Ingrédients" onClick={() => onGoto?.("ingredients")} />
          <StatTile icon="utensils" tint="rgba(91,156,246,0.14)" color="#5b9cf6" value={ust} label="Ustensiles" onClick={() => onGoto?.("ustensiles")} />
          <StatTile icon="list2" tint="rgba(var(--accent-rgb),0.14)" color="var(--accent)" value={tech} label="Techniques" onClick={() => onGoto?.("techniques")} />
        </div>
      </div>

      {/* À compléter */}
      <div>
        <Label>À compléter</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <TodoCard icon="photo" count={ingNoImg} total={ing} label="Ingrédients sans photo" onClick={() => onGoto?.("ingredients", "no-image")} />
          <TodoCard icon="fileText" count={ingNoNut} total={ing} label="Ingrédients sans valeurs nutritionnelles" onClick={() => onGoto?.("ingredients", "no-nutrition")} />
          <TodoCard icon="photo" count={ustNoImg} total={ust} label="Ustensiles sans photo" onClick={() => onGoto?.("ustensiles")} />
        </div>
      </div>
    </div>
  );
}
