import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../ui/Icon.jsx";
import { CookModeHeader } from "../cookMode/CookModeHeader.jsx";
import { CookStepView } from "../cookMode/CookStepView.jsx";
import { UtensilPrecautionSheet } from "../recipe/QualityHints.jsx";
import { useModalExit } from "../../hooks/useModalExit.js";
import { fmtQtyUnit, fmtTime } from "@/lib/format.js";
import { clockLabel } from "@/lib/planning/serveSchedule.js";
import { stepLinked } from "@/lib/recipes/stepLinks.js";
import { createIngredientResolver, resolveLineEntry, type DbEntry } from "@/lib/food/nameMatcher.js";
import { findUtensilEntry } from "@/lib/utensils/utensilLookup.js";
import { resolveUsagePrecaution } from "@/lib/utensils/usagePrecaution.js";
import type { ServiceTask } from "@/lib/planning/mealService.js";
import type { Recipe, Utensil, UtensilDbItem } from "@/lib/types.js";
import type { PrecautionSheetTarget } from "../recipeDetail/recipeView.js";

/** Bases de référence pour illustrer une étape (vignettes, réglages, précautions). */
export interface StepReferences {
  ingredientDB?: DbEntry[];
  utensilDB?: UtensilDbItem[];
}

interface ServiceStepModalProps {
  dishName: string;
  recipe: Pick<Recipe, "steps" | "ingredients" | "utensils"> | undefined;
  /** Étapes placées du plat, dans l'ordre de la recette (navigation précédente / suivante). */
  tasks: ServiceTask[];
  stepIndex: number;
  references?: StepReferences;
  onNavigate: (stepIndex: number) => void;
  onClose: () => void;
  /** Étape cochable (session batch) : état et bascule. */
  checked?: boolean;
  onToggle?: () => void;
}

/** Pastilles d'une étape dans le plan : mains, attente, four, durée estimée. */
function TaskTags({ task }: { task: ServiceTask }) {
  const wait = task.minutes - task.active;
  return (
    <span className="serve-tags">
      {task.active > 0 && <span className="serve-tag is-hands"><Icon name="utensils" size={11} color="currentColor" />{fmtTime(task.active)} mains</span>}
      {wait > 0 && (task.oven
        ? <span className="serve-tag is-oven"><Icon name="fire" size={11} color="currentColor" />{task.temperature != null ? `${task.temperature} °C · ` : ""}{fmtTime(wait)}</span>
        : <span className="serve-tag"><Icon name="clock" size={11} color="currentColor" />{fmtTime(wait)} d'attente</span>)}
      {task.source !== "recipe" && <span className="serve-tag is-estimated">estimée</span>}
    </span>
  );
}

/**
 * Étape d'un plat ouverte depuis la frise, dans l'habit du mode cuisine : même
 * en-tête et barre de progression, même rendu d'étape ({@link CookStepView}),
 * même navigation Précédent / Suivant, plus son créneau dans le plan. Fenêtre
 * centrée sur ordinateur, plein écran sur téléphone ; Échap, le fond ou la croix
 * la referment.
 */
export function ServiceStepModal({ dishName, recipe, tasks, stepIndex, references, onNavigate, onClose, checked = false, onToggle }: ServiceStepModalProps) {
  const { closing, surfaceRef, beginClose, onAnimationEnd } = useModalExit<HTMLDivElement>(onClose);
  const [precSheet, setPrecSheet] = useState<PrecautionSheetTarget | null>(null);
  const ingredientDB = references?.ingredientDB;
  const utensilDB = references?.utensilDB;
  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const position = tasks.findIndex(task => task.stepIndex === stepIndex);
  const task = tasks[position];
  const step = recipe?.steps?.[stepIndex];
  if (!task || !step) return null;
  const total = recipe?.steps?.length ?? 1;
  const previous = tasks[position - 1];
  const next = tasks[position + 1];
  const utensilOf = (utensil: Utensil) => findUtensilEntry(utensilDB, utensil.dbId, utensil.name);

  return createPortal(
    <div className={`cook-step-modal${closing ? " is-closing" : ""}`} onClick={e => { if (e.target === e.currentTarget) beginClose(); }}>
      <div ref={surfaceRef} className={`cook-step-modal__surface${closing ? " is-closing" : ""}`} onAnimationEnd={onAnimationEnd} role="dialog" aria-modal="true" aria-label={`${dishName}, étape ${stepIndex + 1}`}>
        <CookModeHeader recipeName={dishName} isNested={false} pageLabel={`Étape ${stepIndex + 1} / ${total} · ${clockLabel(task.start)} → ${clockLabel(task.end)}`}
          progress={(stepIndex + 1) / total * 100} onClose={() => beginClose()} />
        <div className="cook-step-modal__scroll">
          <div className="cook-step-modal__col">
            <div className="cook-step-modal__plan"><TaskTags task={task} /></div>
            <CookStepView step={step} number={stepIndex + 1} ingredients={stepLinked(recipe?.ingredients, step.ingredients)} utensils={stepLinked(recipe?.utensils, step.utensils)} mult={1}
              displayQty={(ing, amount) => fmtQtyUnit(amount, ing.unit)}
              getIngImage={(dbId, name) => resolveLineEntry(dbId, name, ingredientDB || [], resolver)?.image || ""}
              getUtImage={(dbId, name) => findUtensilEntry(utensilDB, dbId, name)?.image || ""}
              applianceOf={utensil => utensilOf(utensil)?.appliance}
              getUtPrecaution={utensil => resolveUsagePrecaution(utensilOf(utensil))}
              onPrecaution={setPrecSheet} />
            {onToggle && (
              <button type="button" className={`serve-cta cook-step-modal__done${checked ? " is-checked" : ""}`} aria-pressed={checked} onClick={onToggle}>
                <Icon name="check" size={16} color="currentColor" />{checked ? "Faite · annuler" : "Marquer comme faite"}
              </button>
            )}
          </div>
        </div>
        <div className="cook-step-modal__nav">
          <button type="button" className="btn btn-ghost btn-pill" style={{ flex: 1 }} disabled={!previous} onClick={() => previous && onNavigate(previous.stepIndex)}>
            <Icon name="back" size={16} /> Précédent
          </button>
          <span className="cook-step-modal__count">{position + 1} / {tasks.length}</span>
          <button type="button" className="btn btn-primary btn-pill btn-flat" style={{ flex: 1 }} disabled={!next} onClick={() => next && onNavigate(next.stepIndex)}>
            Suivant <Icon name="forward" size={16} />
          </button>
        </div>
      </div>
      {precSheet && <UtensilPrecautionSheet utensilName={precSheet.name} precaution={precSheet.prec} zIndex={480} onClose={() => setPrecSheet(null)} />}
    </div>,
    document.body,
  );
}
