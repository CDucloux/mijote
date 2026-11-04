import { Icon } from "../ui/Icon.jsx";
import { BaseIcon } from "../ui/BaseIcon.jsx";
import { Img, IngImage } from "../ui/Img.jsx";
import { UtImage } from "../recipe/StepPills.jsx";
import { StepTip } from "../recipe/StepTip.jsx";
import { TechniqueText } from "../recipe/TechniqueText.jsx";
import { PrecautionInfoBadge } from "../recipe/QualityHints.jsx";
import { StepTimerButtons } from "./StepTimerButtons.jsx";
import { capitalize } from "@/lib/format.js";
import { formatParamSummary } from "@/lib/utensils/appliances.js";
import type { IngredientLine, Recipe, Step, UsagePrecaution, Utensil } from "@/lib/types.js";
import type { TechniqueIndex } from "@/lib/recipes/techniques.js";
import type { StepDuration } from "@/lib/planning/stepTimers.js";
import type { PrecautionSheetTarget } from "../recipeDetail/recipeView.js";

export interface CookStepViewProps {
  step: Step;
  /** Numéro affiché (1 pour la première étape). */
  number: number;
  techIndex?: TechniqueIndex;
  ingredients: IngredientLine[];
  utensils: Utensil[];
  mult: number;
  /** Quantité affichée, dans l'unité de cuillère choisie le cas échéant. */
  displayQty: (ing: IngredientLine, amount: number) => string;
  getIngImage: (dbId: string | undefined, name: string | undefined) => string;
  getUtImage: (dbId: string | undefined, name: string | undefined) => string;
  /** Clé d'appareil d'un ustensile (résumé de ses réglages). */
  applianceOf: (utensil: Utensil) => unknown;
  getUtPrecaution: (utensil: Utensil) => UsagePrecaution | null;
  onPrecaution: (target: PrecautionSheetTarget) => void;
  recipesById?: ReadonlyMap<string | undefined, Recipe>;
  /** Minuteurs de l'étape (mode cuisine) ; absents, aucun bouton. */
  timers?: { durations: StepDuration[]; sheetZIndex: number; onStart: (duration: StepDuration) => void };
}

const PANEL_LABEL = { fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 } as const;

/**
 * Une étape telle que le mode cuisine la montre : section, numéro, consigne avec
 * ses gestes techniques, minuteurs, astuce, ingrédients et ustensiles liés, photo.
 * Partagée par le pas à pas et par l'étape ouverte depuis la frise du rétro planning.
 */
export function CookStepView({ step, number, techIndex, ingredients, utensils, mult, displayQty, getIngImage, getUtImage, applianceOf, getUtPrecaution, onPrecaution, recipesById, timers }: CookStepViewProps) {
  const renderIngLine = (ing: IngredientLine) => {
    const isComp = !!ing.recipeId && !ing.dbId;
    const comp = isComp && recipesById ? recipesById.get(ing.recipeId) : null;
    const displayName = isComp ? (comp?.name || ing.name || "Préparation introuvable") : ing.name;
    const imgSrc = isComp ? (comp?.image || "") : getIngImage(ing.dbId, ing.name);
    return (
      <div key={ing.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {isComp
          ? <span style={{ width: 42, height: 42, borderRadius: 10, background: "rgba(var(--accent-rgb),0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BaseIcon size={22} /></span>
          : <IngImage src={imgSrc} alt={displayName} size={42} />
        }
        <span style={{ flex: 1, fontSize: 14, color: isComp ? "var(--accent)" : "var(--text)", fontWeight: isComp ? 600 : 400 }}>{capitalize(displayName)}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)" }}>
          {displayQty(ing, Number(ing.amount) * (mult || 1))}
        </span>
      </div>
    );
  };

  return (
    <>
      {step.group && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, fontFamily: "var(--ff-display)", fontSize: 14.5, fontWeight: 700, color: "var(--accent)" }}>
          <Icon name="layers" size={14} color="var(--accent)" /> {step.group}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, color: "#fff", flexShrink: 0 }}>{number}</div>
        <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600 }}>Étape {number}</h2>
      </div>
      <p style={{ fontSize: 16, color: "var(--text)", lineHeight: 1.8, marginBottom: timers ? 14 : 24 }}><TechniqueText key={number} text={step.text ?? ""} index={techIndex} /></p>

      {timers && <StepTimerButtons durations={timers.durations} sheetZIndex={timers.sheetZIndex} onStart={timers.onStart} />}

      {step.tip && <StepTip tip={step.tip} size="lg" style={{ marginBottom: 20 }} />}

      {ingredients.length > 0 && (
        <div className="cook-panel">
          <div style={PANEL_LABEL}>Pour cette étape</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ingredients.map(renderIngLine)}
          </div>
        </div>
      )}

      {utensils.length > 0 && (
        <div className="cook-panel">
          <div style={PANEL_LABEL}>Ustensiles</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {utensils.map(u => {
              const detail = formatParamSummary(applianceOf(u), u.id ? step.utensilParams?.[u.id] : undefined);
              const prec = getUtPrecaution(u);
              return (
              <span key={u.id} onClick={prec ? () => onPrecaution({ name: u.name, prec }) : undefined} className={prec ? "pressable" : undefined} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, background: "var(--surface2)", borderRadius: 20, padding: prec ? "5px 30px 5px 5px" : "5px 12px 5px 5px", fontWeight: 500, color: "var(--text)", cursor: prec ? "pointer" : "default" }}>
                <UtImage src={getUtImage(u.dbId, u.name)} alt={u.name} size={24} />
                {u.name}
                {detail && <span style={{ color: "var(--text3)", fontWeight: 400 }}>{detail}</span>}
                {prec && <PrecautionInfoBadge tone={prec.tone} style={{ top: "50%", right: 6, transform: "translateY(-50%)", width: 20, height: 20 }} />}
              </span>
              );
            })}
          </div>
        </div>
      )}

      {step.image && (
        <Img src={step.image} alt={`Étape ${number}`} style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 16, marginBottom: 20 }} />
      )}
    </>
  );
}
