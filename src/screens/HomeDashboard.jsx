import { useMemo, useState } from "react";
import { Icon } from "../components/Icon.jsx";
import { Img } from "../components/Img.jsx";
import { UserAvatar } from "../components/UserAvatar.jsx";
import { DiscoverSection } from "../components/DiscoverSection.jsx";
import { HouseholdPanel } from "../components/HouseholdPanel.jsx";
import { SwipeableSheet } from "../components/SwipeableSheet.jsx";
import { useAppShell } from "../context/AppShellContext.jsx";
import { useHousehold } from "../hooks/useHousehold.js";
import { peopleCount, MAX_HOUSEHOLD } from "../lib/household.js";
import { buildDashboardSummary } from "../lib/dashboard.js";
import { fmtTime } from "../lib/format.js";

// ─── HOME / ACCUEIL ───────────────────────────────────────────────────────────
const SLOT_LABEL = { midi: "🌤 Ce midi", soir: "🌙 Ce soir" };

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 18) return "Bonjour";
  return "Bonsoir";
}

// Carte de notification compacte (courses, stock bas) – icône + libellé + chevron.
function NotifRow({ icon, color, title, subtitle, onClick, animationDelay }) {
  return (
    <button onClick={onClick} className="slide-up"
      style={{
        animationDelay,
        display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
        padding: "13px 14px", borderRadius: 18,
        background: "var(--surface)", border: "1px solid var(--border)",
        cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 20px ${color}28`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}>
      <span style={{
        width: 44, height: 44, borderRadius: 13, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `${color}1a`, border: `1px solid ${color}30`,
      }}>
        <Icon name={icon} size={20} color={color} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>{title}</span>
        {subtitle && <span style={{ display: "block", fontSize: 12, color: "var(--text3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>}
      </span>
      <Icon name="forward" size={16} color="var(--text3)" />
    </button>
  );
}

// Section « Foyer » repliable dans l'Accueil : un résumé d'une ligne (nom du
// foyer + jauge de places, ou invitation à en créer un) qui se déplie sur le
// panneau de gestion complet. Évite d'aller fouiller dans la Configuration.
function FoyerSection() {
  const { household, invites, loading } = useHousehold();
  const [open, setOpen] = useState(false);
  if (loading) return null;

  const hasInvite = invites.length > 0;
  const summary = household
    ? `${peopleCount(household)}/${MAX_HOUSEHOLD} ${peopleCount(household) > 1 ? "membres" : "membre"}`
    : hasInvite ? "Invitation en attente" : "Cuisinez à plusieurs";

  return (
    <section style={{ marginBottom: 26 }}>
      <button onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
          padding: "13px 14px", borderRadius: 18, cursor: "pointer",
          background: "var(--surface)", border: "1px solid var(--border)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        }}>
        <span style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(232,112,58,0.1)", border: "1px solid rgba(232,112,58,0.3)",
          fontSize: 20, lineHeight: 1,
        }}>🏡</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {household ? household.name : "Mon foyer"}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            {summary}
            {hasInvite && !household && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />}
          </span>
        </span>
        <span style={{ display: "inline-flex" }}>
          <Icon name="forward" size={16} color="var(--text3)" />
        </span>
      </button>
      {open && (
        <SwipeableSheet onClose={() => setOpen(false)} style={{ maxHeight: "88dvh" }}>
          <h2 style={{ fontFamily: "var(--ff-display)", fontSize: 22, fontWeight: 600, margin: "0 0 16px" }}>Foyer</h2>
          <HouseholdPanel />
        </SwipeableSheet>
      )}
    </section>
  );
}

export function HomeDashboard({ recipes = [], mealPlan = {}, shoppingLists = [], lowStock = [], ingredientDB = [], preferences, onSelectRecipe, setTab, onOpenPublic, onClonePublic }) {
  const { user } = useAppShell();
  const firstName = (user?.displayName || "").trim().split(" ")[0] || "";

  const summary = useMemo(
    () => buildDashboardSummary({ mealPlan, recipes, shoppingLists, lowStock, ingredientDB }),
    [mealPlan, recipes, shoppingLists, lowStock, ingredientDB]
  );
  const { meals, shoppingTodo, lowStockNames, isCalm } = summary;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* En-tête */}
      <div style={{ padding: "20px 20px 8px", flexShrink: 0, background: "linear-gradient(180deg, rgba(232,112,58,0.07), transparent)" }}>
        <div className="slide-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: "var(--ff-display)", fontSize: 26, fontWeight: 500, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName ? `${greeting()}, ${firstName} !` : `${greeting()} !`}</h1>
            <span style={{ fontSize: 12.5, color: "var(--text3)", fontWeight: 500, marginTop: 3 }}>
              Bienvenue sur <span style={{ fontFamily: "var(--ff-display)", fontWeight: 600, color: "var(--text2)" }}>Mijoté<span style={{ color: "var(--accent)" }}>·</span></span>
            </span>
          </div>
          <UserAvatar />
        </div>
      </div>

      {/* Corps défilant */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
        {/* ── Aujourd'hui ─────────────────────────────────────────────────── */}
        <section style={{ marginBottom: isCalm ? 18 : 26 }}>
          {!isCalm && (
            <h2 className="slide-up" style={{ animationDelay: "0.04s", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Aujourd'hui
            </h2>
          )}

          {isCalm ? (
            <button className="slide-up" onClick={() => setTab?.("meal-plan")}
              style={{ animationDelay: "0.04s", display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "11px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", cursor: "pointer" }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: "rgba(76,175,125,0.16)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="check" size={15} color="var(--green)" />
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <strong style={{ fontWeight: 600 }}>Tout est à jour</strong>
                <span style={{ color: "var(--text3)" }}> · rien de planifié, courses et stock OK</span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 600, color: "var(--accent)", flexShrink: 0 }}>Planifier <Icon name="forward" size={13} color="var(--accent)" /></span>
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Repas du jour */}
              {meals.map((m, i) => (
                <button key={i} onClick={() => onSelectRecipe?.(m.recipe.id)} className="slide-up"
                  style={{
                    animationDelay: `${i * 0.06}s`,
                    display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
                    padding: "12px 14px", borderRadius: 18, cursor: "pointer", overflow: "hidden",
                    background: "var(--surface)", border: "1px solid var(--border)",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = m.slot === "midi" ? "#e0a800" : "#4a80d4"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.12)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.07)"; }}>
                  <div style={{ width: 70, height: 70, borderRadius: 14, overflow: "hidden", flexShrink: 0, boxShadow: "0 3px 10px rgba(0,0,0,0.14)" }}>
                    <Img src={m.recipe.image} alt={m.recipe.name} style={{ width: "100%", height: "100%" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                      background: m.slot === "midi" ? "rgba(240,192,96,0.22)" : "rgba(91,156,246,0.18)",
                      color: m.slot === "midi" ? "#9a6700" : "#3060b8",
                      marginBottom: 6,
                    }}>
                      {SLOT_LABEL[m.slot] || "Au menu"}
                    </span>
                    <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.recipe.name}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3 }}>
                      {fmtTime((m.recipe.prepTime || 0) + (m.recipe.cookTime || 0))}{m.recipe.ingredients?.length ? ` · ${m.recipe.ingredients.length} ingr.` : ""}
                    </div>
                  </div>
                  <Icon name="forward" size={16} color="var(--text3)" />
                </button>
              ))}

              {/* Courses à faire */}
              {shoppingTodo > 0 && (
                <NotifRow
                  animationDelay={`${meals.length * 0.06 + 0.04}s`}
                  icon="shopping" color="var(--accent)"
                  onClick={() => setTab?.("shopping")}
                  title={`${shoppingTodo} article${shoppingTodo > 1 ? "s" : ""} à acheter`}
                  subtitle="Ta liste de courses t'attend" />
              )}

              {/* Stock bas */}
              {lowStockNames.length > 0 && (
                <NotifRow
                  animationDelay={`${(meals.length + (shoppingTodo > 0 ? 1 : 0)) * 0.06 + 0.04}s`}
                  icon="warning" color="#e8920a"
                  onClick={() => setTab?.("fridge")}
                  title={`${lowStockNames.length} ingrédient${lowStockNames.length > 1 ? "s" : ""} à racheter bientôt`}
                  subtitle={lowStockNames.slice(0, 4).join(" · ")} />
              )}
            </div>
          )}
        </section>

        {/* ── Mon foyer ───────────────────────────────────────────────────── */}
        <FoyerSection />

        {/* ── Découvrir la communauté ─────────────────────────────────────── */}
        <DiscoverSection ingredientDB={ingredientDB} preferences={preferences} recipes={recipes} onOpenPublic={onOpenPublic} onClonePublic={onClonePublic} />
      </div>
    </div>
  );
}
