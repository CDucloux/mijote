import { Icon, type IconName } from "../ui/Icon.jsx";
import { RecipeImage } from "../recipe/RecipePlaceholder.jsx";
import { shortDayLabel, storageZone, storeKey, type BatchStorage, type DishStorage } from "@/lib/planning/batchPlan.js";
import { SLOT_BY_ID } from "../../constants/mealSlots.js";
import type { Recipe } from "@/lib/types.js";

interface BatchStoreTabProps {
  storage: BatchStorage;
  recipeOf: (recipeId: string) => Recipe | undefined;
  isChecked: (key: string) => boolean;
  onToggle: (key: string) => void;
}

const ZONES: { id: ReturnType<typeof storageZone>; title: string; icon: IconName; tone: string }[] = [
  { id: "fridge", title: "Au frigo", icon: "snow", tone: "is-fridge" },
  { id: "mixed", title: "Frigo puis congélateur", icon: "layers", tone: "" },
  { id: "freezer", title: "Au congélateur", icon: "snow", tone: "" },
];

/** Carte d'un plat : ses boîtes, jour par jour, et le rappel de décongélation. */
function DishCard({ dish, recipe, checked, onToggle }: { dish: DishStorage; recipe: Recipe | undefined; checked: boolean; onToggle: () => void }) {
  const thaws = dish.meals.filter(meal => meal.thawOn);
  return (
    <button type="button" className={`bt-dish${checked ? " is-done" : ""}`} aria-pressed={checked} onClick={onToggle}>
      <span className="bt-dish__top">
        <span className="bt-dish__img">{recipe && <RecipeImage recipe={recipe} fontSize={17} />}</span>
        <span className="bt-dish__nm"><b>{recipe?.name ?? "Plat"}</b><span>{checked ? "Rangé" : `frigo jusqu'au ${shortDayLabel(dish.fridgeUntil)}`}</span></span>
        <span className="bt-dish__cnt">{checked ? <Icon name="check" size={13} color="currentColor" /> : `${dish.meals.length} boîte${dish.meals.length > 1 ? "s" : ""}`}</span>
      </span>
      {!checked && (
        <span className="bt-meals">
          {dish.meals.map(meal => (
            <span key={`${meal.date}${meal.slot}`} className="bt-meal">
              <span className="bt-meal__d">{shortDayLabel(meal.date)} {SLOT_BY_ID[meal.slot]?.label.toLowerCase() ?? ""}</span>
              <span className={`bt-zone ${meal.zone === "fridge" ? "is-fridge" : ""}`}>{meal.zone === "fridge" ? "Frigo" : "Congél."}</span>
            </span>
          ))}
          {thaws.length > 0 && (
            <span className="bt-thaw"><Icon name="bell" size={12} color="currentColor" />
              Sortir du congélateur la veille : {thaws.map(meal => shortDayLabel(meal.thawOn ?? meal.date)).join(", ")}
            </span>
          )}
        </span>
      )}
    </button>
  );
}

/**
 * Onglet « Ranger » : où va chaque boîte, frigo ou congélateur selon le jour où le
 * repas sera mangé, avec les dates limites et les jours de décongélation. Un plat
 * rangé se coche.
 */
export function BatchStoreTab({ storage, recipeOf, isChecked, onToggle }: BatchStoreTabProps) {
  if (!storage.dishes.length) return <p className="bt-empty">Aucun repas à ranger : les repas de la semaine tombent avant le jour de la session.</p>;
  return (
    <>
      <div className="bt-boxes">
        <span className="bt-box"><b>{storage.fridge + storage.freezer}</b><span><Icon name="box" size={12} color="currentColor" />boîtes</span></span>
        <span className="bt-box is-fridge"><b>{storage.fridge}</b><span>au frigo</span></span>
        <span className="bt-box"><b>{storage.freezer}</b><span><Icon name="snow" size={12} color="currentColor" />congélateur</span></span>
      </div>
      {ZONES.map(zone => {
        const dishes = storage.dishes.filter(dish => storageZone(dish) === zone.id);
        if (!dishes.length) return null;
        return (
          <section key={zone.id} className="bt-zone-s">
            <header className="bt-zone-s__h"><span className={`bt-zone-s__ic ${zone.tone}`}><Icon name={zone.icon} size={15} color="currentColor" /></span><b>{zone.title}</b></header>
            {dishes.map(dish => <DishCard key={dish.recipeId} dish={dish} recipe={recipeOf(dish.recipeId)} checked={isChecked(storeKey(dish))} onToggle={() => onToggle(storeKey(dish))} />)}
          </section>
        );
      })}
      {storage.skipped > 0 && <p className="bt-empty">{storage.skipped} repas tombe{storage.skipped > 1 ? "nt" : ""} avant la session : il{storage.skipped > 1 ? "s ne sont" : " n'est"} pas compté{storage.skipped > 1 ? "s" : ""}.</p>}
      <div className="bt-safe"><Icon name="info" size={15} color="currentColor" />
        <span>Laisse tiédir 1 h au plus avant de fermer les boîtes : au-delà de 2 h à température ambiante, les bactéries ont le temps de s'installer.</span>
      </div>
    </>
  );
}
