import { Icon } from "../ui/Icon.jsx";
import { Img } from "../ui/Img.jsx";
import { SwipeableSheet } from "../ui/SwipeableSheet.jsx";
import { TechniqueText } from "../recipe/TechniqueText.jsx";
import { StepTip } from "../recipe/StepTip.jsx";
import { TaskTags } from "./ServiceRoadmap.jsx";
import { fmtQtyUnit } from "@/lib/format.js";
import { clockLabel } from "@/lib/planning/serveSchedule.js";
import { stepLinked } from "@/lib/recipes/stepLinks.js";
import type { ServiceTask } from "@/lib/planning/mealService.js";
import type { Recipe } from "@/lib/types.js";

interface ServiceStepSheetProps {
  dishName: string;
  recipe: Pick<Recipe, "steps" | "ingredients" | "utensils"> | undefined;
  /** Étapes placées du plat, dans l'ordre de la recette (navigation précédente / suivante). */
  tasks: ServiceTask[];
  stepIndex: number;
  onNavigate: (stepIndex: number) => void;
  onClose: () => void;
}

/**
 * Étape d'un plat ouverte depuis la frise, rendue comme dans le mode cuisine :
 * consigne avec ses gestes techniques, astuce, ingrédients et ustensiles liés,
 * photo, et son créneau dans le plan. On passe d'une étape du plat à l'autre
 * sans refermer.
 */
export function ServiceStepSheet({ dishName, recipe, tasks, stepIndex, onNavigate, onClose }: ServiceStepSheetProps) {
  const position = tasks.findIndex(task => task.stepIndex === stepIndex);
  const task = tasks[position];
  const step = recipe?.steps?.[stepIndex];
  if (!task || !step) return null;
  const ingredients = stepLinked(recipe?.ingredients, step.ingredients);
  const utensils = stepLinked(recipe?.utensils, step.utensils);
  const previous = tasks[position - 1];
  const next = tasks[position + 1];
  return (
    <SwipeableSheet onClose={onClose} zIndex={460} style={{ maxHeight: "88dvh" }}>
      <span className="svc-step__dish">{dishName}</span>
      {step.group && <span className="svc-step__group"><Icon name="layers" size={13} color="currentColor" />{step.group}</span>}
      <div className="svc-step__head">
        <span className="svc-step__num">{stepIndex + 1}</span>
        <h3 className="svc-step__title">Étape {stepIndex + 1}<small> / {recipe?.steps?.length ?? 1}</small></h3>
      </div>
      <div className="svc-step__when">
        <span className="svc-step__clock">{clockLabel(task.start)} → {clockLabel(task.end)}</span>
        <TaskTags task={task} />
      </div>
      <p className="svc-step__text"><TechniqueText key={stepIndex} text={step.text ?? ""} /></p>
      {step.tip && <StepTip tip={step.tip} size="lg" style={{ marginBottom: 18 }} />}
      {ingredients.length > 0 && (
        <section className="svc-step__panel">
          <h4 className="svc-step__label">Pour cette étape</h4>
          <ul className="svc-step__ings">
            {ingredients.map(line => (
              <li key={line.id}>
                <span>{line.name}</span>
                {line.amount != null && line.amount !== "" && <b>{line.unit ? fmtQtyUnit(line.amount, line.unit) : line.amount}</b>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {utensils.length > 0 && (
        <section className="svc-step__panel">
          <h4 className="svc-step__label">Ustensiles</h4>
          <div className="svc-step__uts">{utensils.map(utensil => <span key={utensil.id}>{utensil.name}</span>)}</div>
        </section>
      )}
      {step.image && <Img src={step.image} alt={`Étape ${stepIndex + 1}`} style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 14, marginBottom: 18 }} />}
      <nav className="svc-step__nav">
        <button type="button" className="btn btn-ghost btn-pill" disabled={!previous} onClick={() => previous && onNavigate(previous.stepIndex)}>
          <Icon name="back" size={15} /> Précédente
        </button>
        <button type="button" className="btn btn-ghost btn-pill" disabled={!next} onClick={() => next && onNavigate(next.stepIndex)}>
          Suivante <Icon name="forward" size={15} />
        </button>
      </nav>
    </SwipeableSheet>
  );
}
