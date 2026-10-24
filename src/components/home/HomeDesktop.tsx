import type { ComponentProps, ReactNode } from "react";
import { Icon } from "../ui/Icon.jsx";
import type { IconName } from "../ui/Icon.jsx";
import { RecipeImage } from "../recipe/RecipePlaceholder.jsx";
import { HouseholdSection } from "../household/HouseholdSection.jsx";
import { SpotlightIngredient } from "../ingredient/SpotlightIngredient.jsx";
import { NotifRow, TodayMealRow, OnboardingCard, CalmDayCard } from "./HomeCards.jsx";
import { SLOT_BY_ID } from "../../constants/mealSlots.js";
import { fmtTime } from "@/lib/format.js";
import type { TodayMealCard, WeekOverview } from "@/lib/planning/dashboard.js";
import type { IngredientDbItem } from "@/lib/types.js";

// ─── ACCUEIL DESKTOP ─────────────────────────────────────────────────────────
// Deux colonnes : à gauche ce qui se passe (le prochain repas domine, en héros,
// puis l'aperçu de la semaine), à droite ce qu'il reste à faire et le contexte
// (courses, stock, foyer, saison). Le mobile garde sa colonne unique (HomePage).

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, margin: "0 2px 12px" }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{children}</h2>
      {action}
    </div>
  );
}

function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="ripple hover-neutral" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", margin: "-5px -10px", borderRadius: 999, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
      {children}<Icon name="forward" size={13} color="currentColor" />
    </button>
  );
}

/** Le prochain repas, en grand : photo, nom, services du repas et actions. */
function MealHero({ card, onOpen, onCook }: { card: TodayMealCard; onOpen: (id: string) => void; onCook: (id: string) => void }) {
  const { recipe } = card.primary;
  const slot = card.slot ? SLOT_BY_ID[card.slot] : undefined;
  const minutes = (Number(recipe.prepTime) || 0) + (Number(recipe.cookTime) || 0);
  const count = recipe.ingredients?.length ?? 0;
  const open = () => { if (recipe.id) onOpen(recipe.id); };
  return (
    <article className="slide-up home-hero">
      <button onClick={open} className="home-hero-media" aria-label={`Ouvrir ${recipe.name}`}>
        {/* Le zoom vit sur une enveloppe : la transition inline (opacité) de l'image écraserait la sienne. */}
        <span className="home-hero-zoom"><RecipeImage recipe={recipe} fontSize={72} /></span>
        {/* Sur la photo, la teinte translucide du créneau se perdait : pastille pleine, icône à la couleur du créneau. */}
        <span className="home-hero-slot">
          <Icon name={(slot?.icon ?? "utensils") as IconName} size={14} weight="fill" color={slot?.accent ?? "var(--accent)"} />
          {slot?.today || "Au menu"}
        </span>
      </button>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, padding: "18px 22px 20px", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 240px" }}>
          <h3 style={{ fontFamily: "var(--ff-display)", fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.1, margin: 0 }}>{recipe.name}</h3>
          <div style={{ fontSize: 13.5, color: "var(--text3)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
            {[minutes > 0 && fmtTime(minutes), count > 0 && `${count} ingrédient${count > 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
          </div>
          {card.others.length > 0 && (
            <div style={{ fontSize: 13.5, color: "var(--text2)", marginTop: 8 }}>
              {card.others.map(o => <span key={o.recipe.id} style={{ marginRight: 12 }}><span style={{ color: "var(--accent)", fontWeight: 700 }}>+</span> {o.recipe.name}</span>)}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-pill" onClick={open} style={{ padding: "10px 18px", fontSize: 14 }}>Voir la recette</button>
          <button className="btn btn-primary btn-pill" onClick={() => { if (recipe.id) onCook(recipe.id); }} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", fontSize: 14 }}>
            <Icon name="chef" size={16} /> Cuisiner
          </button>
        </div>
      </div>
    </article>
  );
}

/** Héros vide : rien de planifié aujourd'hui, mais des courses ou du stock à suivre. */
function NoMealHero({ onPlan }: { onPlan: () => void }) {
  return (
    <div className="slide-up" style={{ background: "var(--float-surface)", boxShadow: "var(--float-shadow)", borderRadius: 22, padding: "28px 26px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <span style={{ width: 52, height: 52, borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(var(--accent-rgb),0.12)", flexShrink: 0 }}>
        <Icon name="calendar" size={24} color="var(--accent)" />
      </span>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>Rien de prévu aujourd'hui</div>
        <div style={{ fontSize: 13.5, color: "var(--text3)", marginTop: 4 }}>Choisis une recette pour ce soir, ou laisse la semaine se remplir.</div>
      </div>
      <button className="btn btn-primary btn-pill" onClick={onPlan} style={{ padding: "10px 20px", fontSize: 14 }}>Planifier</button>
    </div>
  );
}

const weekdayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const dayLabel = (key: string) => weekdayFmt.format(new Date(`${key}T12:00:00`)).replace(".", "");

/** Aperçu de la semaine : un point par créneau, plein si une recette y est prévue. */
function WeekStrip({ week, onOpenPlan }: { week: WeekOverview; onOpenPlan: () => void }) {
  return (
    <section className="slide-up" style={{ animationDelay: "0.06s" }}>
      <SectionTitle action={<TextLink onClick={onOpenPlan}>Planning</TextLink>}>Cette semaine</SectionTitle>
      <div className="dash-surface home-week">
        {week.days.map(day => (
          <button key={day.key} onClick={onOpenPlan} className="ripple hover-neutral home-week-day" data-today={day.isToday || undefined} data-past={day.isPast || undefined}
            aria-label={`${dayLabel(day.key)} ${Number(day.key.slice(8))} : ${day.slots.filter(s => s.filled).length} repas prévu(s) sur ${day.slots.length}`}>
            <span className="home-week-name">{dayLabel(day.key)}</span>
            <span className="home-week-num">{Number(day.key.slice(8))}</span>
            <span style={{ display: "flex", gap: 5 }} aria-hidden="true">
              {day.slots.map(s => <span key={s.slot} className="home-week-dot" data-filled={s.filled || undefined} title={SLOT_BY_ID[s.slot]?.label} />)}
            </span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: "var(--text3)", margin: "10px 4px 0" }}>
        {week.free > 0
          ? <>{week.free} créneau{week.free > 1 ? "x" : ""} libre{week.free > 1 ? "s" : ""} d'ici dimanche</>
          : "Toute la semaine est prévue."}
      </div>
    </section>
  );
}

interface HomeDesktopProps {
  loading: boolean;
  isEmpty: boolean;
  isCalm: boolean;
  hero: TodayMealCard | null;
  rest: TodayMealCard[];
  week: WeekOverview;
  shoppingTodo: number;
  lowStockNames: string[];
  spotlight: IngredientDbItem | null;
  onOpenRecipe: (id: string) => void;
  onCook: (id: string) => void;
  onNewRecipe: () => void;
  onExplore: () => void;
  onGoto: (tab: "meal-plan" | "shopping" | "stock") => void;
  onLowStock: () => void;
  onOpenIngredient?: ComponentProps<typeof SpotlightIngredient>["onOpenIngredient"];
  onExploreSeason?: ComponentProps<typeof SpotlightIngredient>["onExplore"];
}

/** Tableau de bord d'accueil au large (≥ 900 px) : héros du prochain repas + rail. */
export function HomeDesktop({ loading, isEmpty, isCalm, hero, rest, week, shoppingTodo, lowStockNames, spotlight, onOpenRecipe, onCook, onNewRecipe, onExplore, onGoto, onLowStock, onOpenIngredient, onExploreSeason }: HomeDesktopProps) {
  if (loading) return (
    <div className="home-desk">
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <div className="skeleton" style={{ aspectRatio: "16 / 8", borderRadius: 22 }} />
        <div className="skeleton" style={{ height: 96, borderRadius: 20 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="skeleton" style={{ height: 72, borderRadius: 18 }} />
        <div className="skeleton" style={{ height: 84, borderRadius: 18 }} />
      </div>
    </div>
  );

  const hasTodo = shoppingTodo > 0 || lowStockNames.length > 0;
  return (
    <div className="home-desk">
      <div style={{ display: "flex", flexDirection: "column", gap: 30, minWidth: 0 }}>
        {isEmpty ? (
          <OnboardingCard onNewRecipe={onNewRecipe} onExplore={onExplore} />
        ) : (
          <section>
            <SectionTitle>Aujourd'hui</SectionTitle>
            {hero ? <MealHero card={hero} onOpen={onOpenRecipe} onCook={onCook} />
              : isCalm ? <CalmDayCard onPlan={() => onGoto("meal-plan")} onNewRecipe={onNewRecipe} onStock={() => onGoto("stock")} onShopping={() => onGoto("shopping")} />
              : <NoMealHero onPlan={() => onGoto("meal-plan")} />}
            {rest.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
                {rest.map((card, i) => <TodayMealRow key={i} card={card} index={i + 1} onOpen={onOpenRecipe} />)}
              </div>
            )}
          </section>
        )}
        {!isEmpty && <WeekStrip week={week} onOpenPlan={() => onGoto("meal-plan")} />}
      </div>

      <aside style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        {spotlight && <SpotlightIngredient ingredient={spotlight} onOpenIngredient={onOpenIngredient} onExplore={onExploreSeason} />}
        {hasTodo && (
          <section style={{ marginBottom: 26 }}>
            <SectionTitle>À faire</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shoppingTodo > 0 && (
                <NotifRow animationDelay="0.04s" icon="shopping" color="var(--accent)" onClick={() => onGoto("shopping")}
                  title={`${shoppingTodo} article${shoppingTodo > 1 ? "s" : ""} à acheter`} subtitle="Ta liste de courses t'attend" />
              )}
              {lowStockNames.length > 0 && (
                <NotifRow animationDelay="0.1s" icon="warning" color="#e8920a" onClick={onLowStock}
                  title={`${lowStockNames.length} ingrédient${lowStockNames.length > 1 ? "s" : ""} à racheter bientôt`} subtitle={lowStockNames.slice(0, 4).join(" · ")} />
              )}
            </div>
          </section>
        )}
        <div>
          <SectionTitle>Mon foyer</SectionTitle>
          <HouseholdSection />
        </div>
      </aside>
    </div>
  );
}
