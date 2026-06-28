import { useMemo } from "react";
import { Icon } from "../components/Icon.jsx";
import { Img } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { RecipeCard } from "../components/RecipeCard.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { createIngredientResolver } from "../lib/nameMatcher.js";
import { isRecipeInSeason } from "../lib/seasonality.js";
import { buildDashboardSummary } from "../lib/dashboard.js";

// ─── HOME / ACCUEIL ───────────────────────────────────────────────────────────
// Page d'atterrissage : un en-tête « Aujourd'hui » (notifications dérivées de
// l'état local) + des idées de saison depuis la bibliothèque + un teaser de la
// découverte communautaire (moteur réel en PR2).

const SLOT_LABEL = { midi: "🌤 Ce midi", soir: "🌙 Ce soir" };
const SLOT_TINT = { midi: "rgba(240,192,96,0.16)", soir: "rgba(91,156,246,0.16)" };
const DISCOVER_FILTERS = [
  { icon: "👨‍🍳", label: "Chef" },
  { icon: "🧑‍🤝‍🧑", label: "Créateur" },
  { icon: "🍽️", label: "Cuisine" },
  { icon: "🌿", label: "De saison" },
  { icon: "🥗", label: "Nutri-Score" },
  { icon: "❤️", label: "Selon mes préférences" },
];

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 18) return "Bonjour";
  return "Bonsoir";
}

// Carte de notification compacte (courses, stock) — icône colorée + libellé + chevron.
function NotifRow({ icon, color, title, subtitle, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", transition: "transform 0.12s, border-color 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}>
      <span style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: color + "22" }}>
        <Icon name={icon} size={18} color={color} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{title}</span>
        {subtitle && <span style={{ display: "block", fontSize: 12, color: "var(--text3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>}
      </span>
      <Icon name="forward" size={16} color="var(--text3)" />
    </button>
  );
}

export function HomeDashboard({ recipes = [], mealPlan = {}, shoppingLists = [], lowStock = [], ingredientDB = [], onSelectRecipe, setTab, onNewRecipe }) {
  const { user } = useAppShell();
  const firstName = (user?.displayName || "").trim().split(" ")[0] || "";

  const resolver = useMemo(() => createIngredientResolver(ingredientDB || []), [ingredientDB]);
  const summary = useMemo(
    () => buildDashboardSummary({ mealPlan, recipes, shoppingLists, lowStock, ingredientDB }),
    [mealPlan, recipes, shoppingLists, lowStock, ingredientDB]
  );
  const { meals, shoppingTodo, lowStockNames, isCalm } = summary;

  // Idées de saison : recettes de la bibliothèque (hors bases) qui sont de saison ce mois-ci.
  const seasonalIdeas = useMemo(
    () => recipes.filter(r => !r.isComponent && isRecipeInSeason(r, resolver)).slice(0, 8),
    [recipes, resolver]
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "20px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 13, color: "var(--text3)", fontWeight: 500 }}>{greeting()}{firstName ? "," : ""}</span>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName || "Bienvenue"}</h1>
          </div>
          <UserAvatar />
        </div>
      </div>

      {/* Corps défilant */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 20px 24px" }}>
        {/* ── Aujourd'hui ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 26 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Aujourd'hui</h2>

          {isCalm ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "28px 20px", borderRadius: 16, background: "var(--surface)", border: "1px dashed var(--border)" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(76,175,125,0.14)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icon name="check" size={24} color="var(--green)" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Rien d'urgent au menu</div>
              <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.5, maxWidth: 280 }}>
                Pas de repas planifié, courses à jour et placards bien remplis. Et si tu planifiais ta semaine&nbsp;?
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 14, borderRadius: 12 }} onClick={() => setTab?.("meal-plan")}>
                <Icon name="calendar" size={15} /> Planifier la semaine
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Repas du jour */}
              {meals.map((m, i) => (
                <button key={i} onClick={() => onSelectRecipe?.(m.recipe.id)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: 10, borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer", overflow: "hidden" }}>
                  <div style={{ width: 60, height: 60, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                    <Img src={m.recipe.image} alt={m.recipe.name} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: SLOT_TINT[m.slot] || "var(--surface2)", color: "var(--text2)", marginBottom: 5 }}>{SLOT_LABEL[m.slot] || "Au menu"}</span>
                    <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.recipe.name}</div>
                  </div>
                  <Icon name="forward" size={18} color="var(--text3)" />
                </button>
              ))}

              {/* Courses à faire */}
              {shoppingTodo > 0 && (
                <NotifRow icon="shopping" color="var(--accent)" onClick={() => setTab?.("shopping")}
                  title={`${shoppingTodo} article${shoppingTodo > 1 ? "s" : ""} à acheter`}
                  subtitle="Ta liste de courses t'attend" />
              )}

              {/* Stock bas */}
              {lowStockNames.length > 0 && (
                <NotifRow icon="warning" color="#e8920a" onClick={() => setTab?.("fridge")}
                  title={`${lowStockNames.length} ingrédient${lowStockNames.length > 1 ? "s" : ""} à racheter bientôt`}
                  subtitle={lowStockNames.slice(0, 4).join(" · ")} />
              )}
            </div>
          )}
        </section>

        {/* ── Idées de saison (depuis la bibliothèque) ────────────────────── */}
        {seasonalIdeas.length > 0 && (
          <section style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 15 }}>🌿</span> Idées de saison
              </h2>
              <button onClick={() => setTab?.("recipes")} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>Tout voir</button>
            </div>
            <div className="recipe-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12 }}>
              {seasonalIdeas.map((r, idx) => (
                <RecipeCard key={r.id} recipe={r} onClick={() => onSelectRecipe?.(r.id)} inSeason style={{ animationDelay: `${idx * 0.04}s` }} />
              ))}
            </div>
          </section>
        )}

        {/* ── Découvrir la communauté (teaser — moteur réel en PR2) ────────── */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Découvrir</h2>
          <div style={{ position: "relative", padding: 18, borderRadius: 18, background: "linear-gradient(155deg, rgba(232,112,58,0.10), rgba(91,156,246,0.07))", border: "1px solid var(--border)", overflow: "hidden" }}>
            {/* Barre de recherche (inerte en PR1) */}
            <div style={{ position: "relative", marginBottom: 12 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", display: "flex", pointerEvents: "none" }}><Icon name="search" size={16} color="var(--text3)" /></span>
              <input className="field-input" placeholder="Rechercher une recette publique…" disabled aria-label="Recherche communautaire (bientôt)" style={{ paddingLeft: 38, opacity: 0.7, cursor: "not-allowed" }} />
            </div>
            {/* Chips de filtres prévus */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {DISCOVER_FILTERS.map(f => (
                <span key={f.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 20, fontSize: 12, fontWeight: 500, background: "var(--surface2)", color: "var(--text3)", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{f.icon}</span>{f.label}
                </span>
              ))}
            </div>
            {/* État vide soigné */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "10px 8px 4px" }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(232,112,58,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <Icon name="sparkle" size={22} color="var(--accent)" />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>La communauté de mijoteurs arrive bientôt</div>
              <div style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.5, maxWidth: 320 }}>
                Bientôt, explore les recettes publiques d'autres cuisiniers — par chef, par cuisine, de saison, selon ton Nutri-Score et tes préférences — et garde tes coups de cœur dans ta bibliothèque.
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 14, borderRadius: 12 }} onClick={onNewRecipe}>
                <Icon name="plus" size={15} /> En attendant, crée une recette
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
